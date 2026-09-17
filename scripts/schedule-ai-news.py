#!/usr/bin/env python3
"""Persistent Monday/Wednesday 17:30 Asia/Tokyo scheduler. Linux, Python 3.11+."""

import argparse
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
import fcntl
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import tempfile
import threading
import time
import uuid
from zoneinfo import ZoneInfo

from ai_news_safety import enforce_identity, permission_probe, validate_container_mounts, validate_trees


TOKYO = ZoneInfo("Asia/Tokyo")
SCHEDULE = "Mon,Wed 17:30 Asia/Tokyo"
MAX_ATTEMPTS = 3


def utcnow():
    return datetime.now(timezone.utc)


def timestamp(value):
    parsed = datetime.fromisoformat(value)
    if parsed.tzinfo is None:
        raise ValueError("State timestamps must include a timezone")
    return parsed.astimezone(timezone.utc)


def scheduled_slot(now, *, previous=False, inclusive=False):
    """Return a UTC slot; calendar calculations always use Tokyo, never host TZ."""
    if now.tzinfo is None:
        raise ValueError("An aware datetime is required")
    local = now.astimezone(TOKYO)
    for offset in range(8):
        day = local + timedelta(days=-offset if previous else offset)
        candidate = day.replace(hour=17, minute=30, second=0, microsecond=0)
        matches = candidate <= local if previous else candidate > local
        if candidate.weekday() in (0, 2) and (matches or (inclusive and candidate == local)):
            return candidate.astimezone(timezone.utc)
    raise ValueError("Cannot find schedule slot")


def atomic_json(path, value):
    """Replace scheduler-owned state only, with file and directory fsync."""
    fd, name = tempfile.mkstemp(prefix=".state-", dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as stream:
            json.dump(value, stream, ensure_ascii=False, indent=2)
            stream.write("\n")
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(name, path)
        directory = os.open(path.parent, os.O_RDONLY | os.O_DIRECTORY)
        try:
            os.fsync(directory)
        finally:
            os.close(directory)
    finally:
        if os.path.exists(name):
            os.unlink(name)


@contextmanager
def scheduler_lock(path):
    # Keep the same inode: never unlink lock files. Children inherit the lock so
    # a killed scheduler cannot leave an unlocked, still-running collector.
    fd = os.open(path, os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600)
    try:
        fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
        yield fd
    finally:
        os.close(fd)


def terminate_group(process, grace=5):
    try:
        os.killpg(process.pid, signal.SIGTERM)
    except ProcessLookupError:
        pass
    try:
        process.wait(timeout=grace)
    except subprocess.TimeoutExpired:
        pass
    # Kill descendants too, even when their parent exited on SIGTERM.
    try:
        os.killpg(process.pid, signal.SIGKILL)
    except ProcessLookupError:
        pass
    process.wait()


def run_process(command, log_path, stop, timeout_seconds, lock_fd):
    """Bound the entire collection with a monotonic deadline, capture both streams."""
    with log_path.open("x", encoding="utf-8") as log:
        if stop.is_set():
            log.write("Scheduler stopped before collector launch\n")
            return {"status": "interrupted", "returncode": None}
        try:
            process = subprocess.Popen(command, stdout=log, stderr=subprocess.STDOUT,
                                       start_new_session=True, pass_fds=(lock_fd,))
        except OSError as error:
            log.write(f"Unable to start collector: {error}\n")
            log.flush()
            os.fsync(log.fileno())
            return {"status": "error", "returncode": None, "error": str(error)}
        deadline = time.monotonic() + timeout_seconds
        try:
            while process.poll() is None:
                if stop.is_set() or time.monotonic() >= deadline:
                    status = "interrupted" if stop.is_set() else "timeout"
                    terminate_group(process)
                    log.write(f"\nScheduler stopped collector: {status}\n")
                    return {"status": status, "returncode": process.returncode}
                stop.wait(min(0.2, max(0, deadline - time.monotonic())))
            return {"status": "success" if process.returncode == 0 else "error",
                    "returncode": process.returncode}
        finally:
            if process.poll() is None:
                terminate_group(process)
            log.flush()
            os.fsync(log.fileno())


class Scheduler:
    def __init__(self, data_dir, stop, lock_fd, *, timeout_seconds=180,
                 retry_seconds=900, clock=utcnow, runner=run_process):
        self.directory = Path(data_dir) / "scheduler"
        self.logs = self.directory / "logs"
        self.state_path = self.directory / "state.json"
        self.stop, self.lock_fd = stop, lock_fd
        self.timeout_seconds, self.retry_seconds = timeout_seconds, retry_seconds
        self.clock, self.runner = clock, runner
        self.command = [sys.executable, "-B", str(Path(__file__).with_name("collect-ai-news.py")),
                        "--output", str(data_dir), "--days", "7"]

    def event(self, kind, **fields):
        entry = {"time": self.clock().isoformat(), "event": kind, **fields}
        line = json.dumps(entry, ensure_ascii=False) + "\n"
        with (self.logs / "events.jsonl").open("a", encoding="utf-8") as stream:
            stream.write(line)
            stream.flush()
            os.fsync(stream.fileno())
        print(line, end="", flush=True)

    def save(self, state):
        atomic_json(self.state_path, state)

    def load(self):
        if not self.state_path.exists():
            state = {"version": 1, "schedule": SCHEDULE,
                     "next_due_at": scheduled_slot(self.clock(), inclusive=True).isoformat(),
                     "attempts": 0, "retry_at": None, "in_flight": None,
                     "last_success_at": None}
            self.save(state)
            self.event("initialized", next_due_at=state["next_due_at"])
            return state
        state = json.loads(self.state_path.read_text())
        required = {"version", "schedule", "next_due_at", "attempts", "retry_at",
                    "in_flight", "last_success_at"}
        if (not isinstance(state, dict) or set(state) != required or state["version"] != 1
                or state["schedule"] != SCHEDULE or type(state["attempts"]) is not int
                or not 0 <= state["attempts"] <= MAX_ATTEMPTS):
            raise ValueError("Invalid scheduler state; preserve and inspect it manually")
        due = timestamp(state["next_due_at"])
        if scheduled_slot(due, inclusive=True) != due:
            raise ValueError("State next_due_at is not a scheduled slot")
        for key in ("retry_at", "last_success_at"):
            if state[key] is not None:
                timestamp(state[key])
        if state["in_flight"] is not None:
            attempt = state["in_flight"]
            if (not isinstance(attempt, dict) or set(attempt) != {"id", "started_at", "due_at", "number"}
                    or not isinstance(attempt["id"], str) or not attempt["id"]
                    or state["attempts"] < 1 or attempt["number"] != state["attempts"]
                    or attempt["due_at"] != state["next_due_at"] or state["retry_at"] is not None):
                raise ValueError("Invalid in-flight state")
            timestamp(attempt["started_at"])
            self.event("interrupted_on_restart", attempt=state["in_flight"])
            self.finish(state, {"status": "interrupted", "returncode": None})
        elif (state["attempts"] >= MAX_ATTEMPTS
              or (state["attempts"] == 0) != (state["retry_at"] is None)):
            raise ValueError("Invalid retry state")
        return state

    def finish(self, state, result):
        now = self.clock()
        state["in_flight"] = None
        if result["status"] == "success":
            state["last_success_at"] = now.isoformat()
        due = timestamp(state["next_due_at"])
        if result["status"] != "success" and now >= scheduled_slot(due):
            # An old failed/crashed attempt must not spend the latest slot's
            # retry budget or skip it when recovering after a long shutdown.
            latest = scheduled_slot(now, previous=True)
            self.event("missed_slots_coalesced", previous_due_at=due.isoformat(), due_at=latest.isoformat())
            state.update(next_due_at=latest.isoformat(), attempts=0, retry_at=None)
        elif result["status"] == "success" or state["attempts"] >= MAX_ATTEMPTS:
            if result["status"] != "success":
                self.event("attempts_exhausted", due_at=state["next_due_at"])
            # Collapse downtime to one collection, never replay a backlog.
            anchor = max(now, timestamp(state["next_due_at"]))
            state.update(next_due_at=scheduled_slot(anchor).isoformat(), attempts=0, retry_at=None)
        else:
            state["retry_at"] = (now + timedelta(seconds=self.retry_seconds)).isoformat()
        self.save(state)

    def tick(self, state):
        now = self.clock()
        due = timestamp(state["next_due_at"])
        if self.stop.is_set() or now < due:
            return False
        if now >= scheduled_slot(due):
            latest = scheduled_slot(now, previous=True)
            self.event("missed_slots_coalesced", previous_due_at=due.isoformat(), due_at=latest.isoformat())
            state.update(next_due_at=latest.isoformat(), attempts=0, retry_at=None)
        if state["retry_at"] and now < timestamp(state["retry_at"]):
            return False
        attempt_id = now.strftime("%Y%m%dT%H%M%SZ") + "-" + uuid.uuid4().hex
        state["attempts"] += 1
        state["retry_at"] = None
        state["in_flight"] = {"id": attempt_id, "started_at": now.isoformat(),
                              "due_at": state["next_due_at"], "number": state["attempts"]}
        self.save(state)  # Persist intent before starting the child.
        self.event("started", **state["in_flight"])
        log_path = self.logs / (attempt_id + ".log")
        try:
            result = self.runner(self.command, log_path, self.stop, self.timeout_seconds, self.lock_fd)
        except Exception as error:
            result = {"status": "error", "returncode": None, "error": f"{type(error).__name__}: {error}"}
        self.event("finished", id=attempt_id, log=log_path.name, **result)
        self.finish(state, result)
        return True


def prepare_directories(data_dir):
    root = Path(data_dir)
    # Require an existing mount; a typo must not silently create an empty inbox.
    if not root.is_dir() or root.is_symlink():
        raise ValueError("Data directory must already exist and must not be a symlink")
    for directory in (root / "scheduler", root / "scheduler/logs"):
        if directory.is_symlink():
            raise ValueError("Scheduler directories must not be symlinks")
        directory.mkdir(mode=0o700, exist_ok=True)
    for name in ("state.json", "logs/events.jsonl"):
        if (root / "scheduler" / name).is_symlink():
            raise ValueError("Scheduler files must not be symlinks")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data-dir", type=Path, default=Path("/data"))
    parser.add_argument("--timeout-seconds", type=int, default=180)
    parser.add_argument("--retry-seconds", type=int, default=900)
    parser.add_argument("--poll-seconds", type=int, default=30)
    parser.add_argument("--check-config", action="store_true", help="Print configuration without writes or collection")
    args = parser.parse_args()
    if not (1 <= args.timeout_seconds <= 3600 and 1 <= args.retry_seconds <= 86400
            and 1 <= args.poll_seconds <= 60):
        parser.error("Invalid timeout, retry or polling interval")
    if args.check_config:
        print(json.dumps({"schedule": SCHEDULE, "data_dir": str(args.data_dir),
                          "next_due_at": scheduled_slot(utcnow(), inclusive=True).isoformat(),
                          "timeout_seconds": args.timeout_seconds, "retry_seconds": args.retry_seconds,
                          "max_attempts": MAX_ATTEMPTS}, indent=2))
        return 0
    os.umask(0o077)
    stop = threading.Event()
    for sig in (signal.SIGTERM, signal.SIGINT):
        signal.signal(sig, lambda *_: stop.set())
    scheduler = None
    try:
        enforce_identity(os.environ.get("AI_NEWS_UID"), os.environ.get("AI_NEWS_GID"))
        validate_container_mounts(args.data_dir)
        permission_probe(validate_trees(args.data_dir))
        prepare_directories(args.data_dir)
        with scheduler_lock(args.data_dir / "scheduler/collector.lock") as lock_fd:
            scheduler = Scheduler(args.data_dir, stop, lock_fd, timeout_seconds=args.timeout_seconds,
                                  retry_seconds=args.retry_seconds)
            state = scheduler.load()
            scheduler.event("scheduler_ready", next_due_at=state["next_due_at"], schedule=SCHEDULE)
            while not stop.is_set():
                scheduler.tick(state)
                stop.wait(args.poll_seconds)
            scheduler.event("scheduler_stopped")
        return 0
    except Exception as error:
        # Never reset corrupt state or mark a failed collection successful.
        message = f"{type(error).__name__}: {error}"
        if scheduler is not None:
            try:
                scheduler.event("fatal", error=message)
            except OSError:
                pass
        print(message, file=sys.stderr, flush=True)
        return 75 if isinstance(error, BlockingIOError) else 1


if __name__ == "__main__":
    raise SystemExit(main())
