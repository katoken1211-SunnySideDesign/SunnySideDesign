from contextlib import redirect_stdout
from datetime import datetime, timedelta, timezone
import importlib.util
import io
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import threading
import unittest
from unittest.mock import patch


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
SPEC = importlib.util.spec_from_file_location("scheduler", ROOT / "scripts/schedule-ai-news.py")
scheduler = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(scheduler)


def dt(value):
    return datetime.fromisoformat(value)


MONDAY = dt("2026-09-21T08:30:00+00:00")  # 17:30 Tokyo
WEDNESDAY = dt("2026-09-23T08:30:00+00:00")


class SchedulerTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        scheduler.prepare_directories(self.root)
        self.stop = threading.Event()
        self.now = MONDAY - timedelta(minutes=1)
        self.results = []
        self.calls = []
        self.output = redirect_stdout(io.StringIO())
        self.output.__enter__()
        self.addCleanup(self.output.__exit__, None, None, None)
        self.app = scheduler.Scheduler(self.root, self.stop, -1, clock=lambda: self.now, runner=self.run_fake)

    def run_fake(self, command, path, stop, timeout, lock_fd):
        self.calls.append(command)
        path.write_text("fixture output\n")
        return self.results.pop(0) if self.results else {"status": "success", "returncode": 0}

    def test_calendar_monday_wednesday_and_weekend(self):
        self.assertEqual(scheduler.scheduled_slot(MONDAY), WEDNESDAY)
        self.assertEqual(scheduler.scheduled_slot(WEDNESDAY), dt("2026-09-28T08:30:00+00:00"))
        self.assertEqual(scheduler.scheduled_slot(MONDAY, inclusive=True), MONDAY)
        self.assertEqual(scheduler.scheduled_slot(dt("2026-09-26T23:59:00+09:00"), previous=True), WEDNESDAY)
        self.assertEqual(scheduler.scheduled_slot(dt("2026-12-30T17:30:00+09:00")), dt("2027-01-04T08:30:00+00:00"))

    def test_timezone_independent_of_environment(self):
        with patch.dict(os.environ, {"TZ": "America/New_York"}):
            self.assertEqual(scheduler.scheduled_slot(dt("2026-09-21T17:29:59+09:00")), MONDAY)
        with self.assertRaises(ValueError):
            scheduler.scheduled_slot(datetime(2026, 9, 21))

    def test_first_boot_waits_without_historical_backfill(self):
        self.now = MONDAY + timedelta(hours=1)
        state = self.app.load()
        self.assertEqual(scheduler.timestamp(state["next_due_at"]), WEDNESDAY)
        self.assertFalse(self.app.tick(state))
        self.assertEqual(self.calls, [])

    def test_success_persists_and_restart_does_not_repeat(self):
        state = self.app.load()
        self.assertFalse(self.app.tick(state))
        self.now = MONDAY
        self.assertTrue(self.app.tick(state))
        reloaded = self.app.load()
        self.assertEqual(reloaded["last_success_at"], MONDAY.isoformat())
        self.assertEqual(scheduler.timestamp(reloaded["next_due_at"]), WEDNESDAY)
        self.assertFalse(self.app.tick(reloaded))
        self.assertEqual(len(self.calls), 1)

    def test_missed_slots_coalesce_to_one_run(self):
        state = self.app.load()
        self.now = dt("2026-10-08T00:00:00+00:00")
        self.assertTrue(self.app.tick(state))
        self.assertEqual(len(self.calls), 1)
        self.assertEqual(scheduler.timestamp(state["next_due_at"]), dt("2026-10-12T08:30:00+00:00"))
        self.assertIn('"event": "missed_slots_coalesced"', (self.app.logs / "events.jsonl").read_text())
        self.assertFalse(self.app.tick(state))

    def test_failure_retries_after_delay_and_stops_at_three(self):
        self.results = [{"status": "error", "returncode": 1}] * 3
        state = self.app.load()
        self.now = MONDAY
        self.app.tick(state)
        self.assertIsNone(state["last_success_at"])
        self.assertFalse(self.app.tick(self.app.load()))
        self.now += timedelta(minutes=15)
        self.app.tick(state)
        self.now += timedelta(minutes=15)
        self.app.tick(state)
        self.assertEqual(len(self.calls), 3)
        self.assertEqual(scheduler.timestamp(state["next_due_at"]), WEDNESDAY)
        self.assertIsNone(state["last_success_at"])
        self.assertIn('"event": "attempts_exhausted"', (self.app.logs / "events.jsonl").read_text())

    def test_failed_retry_then_success(self):
        state = self.app.load()
        self.results = [{"status": "timeout", "returncode": -15}]
        self.now = MONDAY
        self.app.tick(state)
        self.now += timedelta(minutes=15)
        self.app.tick(state)
        self.assertEqual(state["last_success_at"], self.now.isoformat())
        self.assertEqual(state["attempts"], 0)

    def test_interrupted_attempt_survives_restart(self):
        state = self.app.load()
        state.update(attempts=1, in_flight={"id": "interrupted-attempt", "number": 1,
                                         "started_at": MONDAY.isoformat(), "due_at": state["next_due_at"]})
        self.app.save(state)
        self.now = MONDAY + timedelta(minutes=1)
        state = self.app.load()
        self.assertIsNone(state["in_flight"])
        self.assertIsNone(state["last_success_at"])
        self.assertFalse(self.app.tick(state))
        self.now += timedelta(minutes=15)
        self.assertTrue(self.app.tick(state))
        self.assertIn('"event": "interrupted_on_restart"', (self.app.logs / "events.jsonl").read_text())

    def test_crash_on_third_attempt_has_bounded_recovery(self):
        state = self.app.load()
        state.update(attempts=3, in_flight={"id": "third-attempt", "number": 3,
                                         "started_at": MONDAY.isoformat(), "due_at": state["next_due_at"]})
        self.app.save(state)
        self.now = MONDAY + timedelta(minutes=31)
        state = self.app.load()
        self.assertEqual(scheduler.timestamp(state["next_due_at"]), WEDNESDAY)
        self.assertFalse(self.app.tick(state))

    def test_crash_on_last_attempt_keeps_latest_overdue_slot(self):
        for attempt in (1, 3):
            for restart_at in (WEDNESDAY, WEDNESDAY + timedelta(hours=1),
                               dt("2026-10-08T00:00:00+00:00")):
                with self.subTest(attempt=attempt, restart_at=restart_at):
                    state = {"version": 1, "schedule": scheduler.SCHEDULE,
                             "next_due_at": MONDAY.isoformat(), "attempts": attempt,
                             "retry_at": None, "last_success_at": None,
                             "in_flight": {"id": "old-crash", "number": attempt,
                                           "started_at": MONDAY.isoformat(), "due_at": MONDAY.isoformat()}}
                    self.app.save(state)
                    self.now = restart_at
                    state = self.app.load()
                    self.assertEqual(scheduler.timestamp(state["next_due_at"]),
                                     scheduler.scheduled_slot(restart_at, previous=True))
                    self.assertEqual(state["attempts"], 0)
                    self.assertIsNone(state["retry_at"])
                    # A failed latest-slot run still has two retries available.
                    self.results = [{"status": "error", "returncode": 1}]
                    self.assertTrue(self.app.tick(state))
                    self.assertEqual(state["attempts"], 1)
                    self.assertFalse(self.app.tick(state))
                    self.now += timedelta(minutes=15)
                    self.assertTrue(self.app.tick(state))
                    self.assertFalse(self.app.tick(state))

    def test_failure_crossing_next_slot_resets_retry_budget(self):
        state = self.app.load()
        state.update(attempts=2, retry_at=(WEDNESDAY - timedelta(minutes=1)).isoformat())
        self.now = WEDNESDAY - timedelta(minutes=1)

        def crosses_slot(*args):
            self.now = WEDNESDAY + timedelta(seconds=30)
            return {"status": "timeout", "returncode": -15}

        self.app.runner = crosses_slot
        self.assertTrue(self.app.tick(state))
        self.assertEqual(scheduler.timestamp(state["next_due_at"]), WEDNESDAY)
        self.assertEqual(state["attempts"], 0)
        self.assertIsNone(state["retry_at"])
        self.app.runner = self.run_fake
        self.assertTrue(self.app.tick(state))
        self.assertFalse(self.app.tick(state))

    def test_corrupt_state_is_not_reset(self):
        for data in ('{broken', '{"version": 999}', '[]'):
            with self.subTest(data=data):
                self.app.state_path.write_text(data)
                with self.assertRaises(ValueError):
                    self.app.load()
                self.assertEqual(self.app.state_path.read_text(), data)

    def test_bad_schedule_state_is_not_reset(self):
        state = self.app.load()
        state["next_due_at"] = "2026-09-22T08:30:00+00:00"  # Tuesday
        self.app.save(state)
        with self.assertRaises(ValueError):
            self.app.load()
        self.assertEqual(json.loads(self.app.state_path.read_text()), state)

    def test_invalid_in_flight_state_is_not_recovered(self):
        state = self.app.load()
        state.update(attempts=1, in_flight={"id": "incomplete"})
        self.app.save(state)
        with self.assertRaises(ValueError):
            self.app.load()
        self.assertEqual(json.loads(self.app.state_path.read_text()), state)

    def test_atomic_state_failure_preserves_previous_state(self):
        state = self.app.load()
        original = self.app.state_path.read_bytes()
        with patch.object(scheduler.os, "replace", side_effect=OSError("disk error")):
            with self.assertRaises(OSError):
                self.app.save({**state, "attempts": 1})
        self.assertEqual(self.app.state_path.read_bytes(), original)

    def test_lock_blocks_second_process_and_releases(self):
        path = self.app.directory / "collector.lock"
        code = ("import fcntl, os, sys; fd=os.open(sys.argv[1],os.O_RDWR); "
                "fcntl.flock(fd, fcntl.LOCK_EX|fcntl.LOCK_NB)")
        with scheduler.scheduler_lock(path):
            result = subprocess.run([sys.executable, "-B", "-c", code, str(path)], capture_output=True)
            self.assertNotEqual(result.returncode, 0)
        result = subprocess.run([sys.executable, "-B", "-c", code, str(path)], capture_output=True)
        self.assertEqual(result.returncode, 0)
        self.assertTrue(path.exists())

    def test_process_failure_captures_stdout_stderr(self):
        path = self.app.logs / "failure.log"
        command = [sys.executable, "-B", "-c", "import sys; print('out'); print('err',file=sys.stderr); sys.exit(1)"]
        with scheduler.scheduler_lock(self.app.directory / "collector.lock") as fd:
            result = scheduler.run_process(command, path, self.stop, 2, fd)
        self.assertEqual(result, {"status": "error", "returncode": 1})
        self.assertIn("out", path.read_text())
        self.assertIn("err", path.read_text())

    def test_inherited_lock_survives_parent_closing_its_descriptor(self):
        path = self.app.directory / "collector.lock"
        with scheduler.scheduler_lock(path) as fd:
            process = subprocess.Popen([sys.executable, "-B", "-c", "import time; time.sleep(20)"],
                                       pass_fds=(fd,))
        try:
            with self.assertRaises(BlockingIOError):
                with scheduler.scheduler_lock(path):
                    pass
        finally:
            process.terminate()
            process.wait(timeout=5)
        with scheduler.scheduler_lock(path):
            pass

    def test_stopped_runner_does_not_launch_process(self):
        self.stop.set()
        with patch.object(scheduler.subprocess, "Popen") as popen:
            result = scheduler.run_process(["unused"], self.app.logs / "no-launch.log", self.stop, 1, -1)
        popen.assert_not_called()
        self.assertEqual(result["status"], "interrupted")

    def test_real_timeout_terminates_and_reaps_child(self):
        path = self.app.logs / "timeout.log"
        command = [sys.executable, "-B", "-c", "import os,time; print(os.getpid(),flush=True); time.sleep(20)"]
        with scheduler.scheduler_lock(self.app.directory / "collector.lock") as fd:
            result = scheduler.run_process(command, path, self.stop, 0.3, fd)
        self.assertEqual(result["status"], "timeout")
        pid = int(path.read_text().splitlines()[0])
        with self.assertRaises(ProcessLookupError):
            os.kill(pid, 0)

    def test_shutdown_interrupts_running_child(self):
        command = [sys.executable, "-B", "-c", "import time; time.sleep(20)"]
        timer = threading.Timer(0.1, self.stop.set)
        timer.start()
        try:
            with scheduler.scheduler_lock(self.app.directory / "collector.lock") as fd:
                result = scheduler.run_process(command, self.app.logs / "stop.log", self.stop, 3, fd)
            self.assertEqual(result["status"], "interrupted")
        finally:
            timer.join()

    def test_stop_prevents_new_run(self):
        state = self.app.load()
        self.now = MONDAY
        self.stop.set()
        self.assertFalse(self.app.tick(state))
        self.assertEqual(self.calls, [])

    def test_check_config_does_not_create_state(self):
        absent = self.root / "absent"
        result = subprocess.run([sys.executable, "-B", str(ROOT / "scripts/schedule-ai-news.py"),
                                 "--check-config", "--data-dir", str(absent)], capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(json.loads(result.stdout)["schedule"], scheduler.SCHEDULE)
        self.assertFalse(absent.exists())

    def test_missing_mount_and_symlinks_fail(self):
        with self.assertRaises(ValueError):
            scheduler.prepare_directories(self.root / "missing")
        link = self.root / "link"
        link.symlink_to(self.root, target_is_directory=True)
        with self.assertRaises(ValueError):
            scheduler.prepare_directories(link)


class DeploymentTests(unittest.TestCase):
    def test_compose_isolated_service_and_persistent_mount(self):
        # JSON is also YAML; this keeps config checks dependency-free.
        config = json.loads((ROOT / "deploy/ai-news-collector/compose.yaml").read_text())
        self.assertEqual(set(config["services"]), {"ai-news-collector"})
        service = config["services"]["ai-news-collector"]
        self.assertNotIn("depends_on", service)
        self.assertNotIn("ports", service)
        self.assertNotIn("privileged", service)
        self.assertTrue(service["read_only"])
        self.assertEqual(service["restart"], "unless-stopped")
        self.assertEqual(service["environment"]["TZ"], "Asia/Tokyo")
        self.assertEqual(service["pull_policy"], "never")
        self.assertEqual(len(service["volumes"]), 3)
        self.assertEqual({m["target"] for m in service["volumes"]},
                         {"/data/items", "/data/runs", "/data/scheduler"})
        for mount in service["volumes"]:
            self.assertFalse(mount["bind"]["create_host_path"])
            self.assertEqual(mount["type"], "bind")
            self.assertIn("${AI_NEWS_INBOX_DIR:?", mount["source"])
            self.assertEqual(mount["source"].rsplit("/", 1)[-1], mount["target"].rsplit("/", 1)[-1])
        self.assertIn("${AI_NEWS_UID:?", service["environment"]["AI_NEWS_UID"])
        self.assertIn("${AI_NEWS_GID:?", service["environment"]["AI_NEWS_GID"])
        self.assertEqual(service["cap_drop"], ["ALL"])
        self.assertIn("${AI_NEWS_UID:?", service["user"])


if __name__ == "__main__":
    unittest.main()
