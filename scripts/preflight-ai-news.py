#!/usr/bin/env python3
"""UGOS host preflight; never starts containers or changes ownership/ACLs."""

import argparse
import inspect
import json
import os
from pathlib import Path
import subprocess
import sys

from ai_news_safety import canonical_directory, enforce_identity, numeric_id, permission_probe, validate_trees


KEYS = {"AI_NEWS_INBOX_DIR", "AI_NEWS_UID", "AI_NEWS_GID"}


def read_settings(path):
    values = {}
    for line in Path(path).read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        key, separator, value = line.partition("=")
        if not separator or key not in KEYS or key in values:
            raise ValueError(f"Unexpected or duplicate setting: {key}")
        if value[:1] in ("'", '"') and value[-1:] == value[:1]:
            value = value[1:-1]
        if not value or any(part in value for part in ("$", "REPLACE", "#", chr(92), "'", '"')):
            raise ValueError(f"Set a literal value for {key}; placeholders/interpolation are forbidden")
        # Compose shell variables override --env-file. Do not validate one value
        # then silently deploy a different inherited environment value.
        if key in os.environ and os.environ[key] != value:
            raise ValueError(f"Environment overrides {key}; unset it or match the env file")
        values[key] = value
    if set(values) != KEYS:
        raise ValueError("Set AI_NEWS_INBOX_DIR, AI_NEWS_UID and AI_NEWS_GID")
    numeric_id(values["AI_NEWS_UID"])
    numeric_id(values["AI_NEWS_GID"])
    return values


def workspace_source():
    result = subprocess.run(["docker", "inspect", "codex-agent", "--format", "{{json .Mounts}}"],
                            check=True, capture_output=True, text=True, timeout=15)
    mounts = [m for m in json.loads(result.stdout) if m.get("Destination") == "/workspace"]
    if len(mounts) != 1 or mounts[0].get("Type") != "bind":
        raise ValueError("Cannot identify the existing /workspace bind mount; inspect the UGOS path manually")
    return mounts[0]["Source"]


def check_host_paths(settings, workspace):
    workspace = canonical_directory(workspace)
    root = canonical_directory(settings["AI_NEWS_INBOX_DIR"])
    if root != workspace / "ai-news-inbox":
        raise ValueError("Inbox must be ai-news-inbox under the verified NAS workspace Source")
    if root == Path("/workspace/ai-news-inbox") or root == Path("/data"):
        raise ValueError("Use the NAS host path, not a development-container path")
    return validate_trees(root)


def probe_as_service(paths, uid, gid):
    uid, gid = numeric_id(uid), numeric_id(gid)
    options = {}
    if os.geteuid() == 0:
        options = {"user": uid, "group": gid, "extra_groups": []}
    else:
        enforce_identity(uid, gid)
        if set(os.getgroups()) - {gid}:
            raise ValueError("Extra host groups could hide container permission failures; run the preflight as a NAS administrator")
    # No shell and no dependence on NAS account access to the repository itself.
    code = inspect.getsource(permission_probe) + "\nimport json, sys\npermission_probe(json.loads(sys.argv[1]))\n"
    result = subprocess.run([sys.executable, "-B", "-c", code, json.dumps([str(p) for p in paths])],
                            capture_output=True, text=True, timeout=60, **options)
    if result.returncode:
        raise PermissionError(f"Service UID/GID preflight failed:\n{result.stderr.strip()}")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--env-file", type=Path, required=True)
    parser.add_argument("--workspace-source", type=Path,
                        help="Verified absolute NAS workspace path; otherwise read it with docker inspect")
    args = parser.parse_args()
    try:
        settings = read_settings(args.env_file)
        paths = check_host_paths(settings, args.workspace_source or workspace_source())
        probe_as_service(paths, settings["AI_NEWS_UID"], settings["AI_NEWS_GID"])
    except (OSError, ValueError, subprocess.SubprocessError) as error:
        print(f"PREFLIGHT FAILED: {error}", file=sys.stderr)
        return 1
    print("PREFLIGHT PASSED: verified host paths; non-root identity; ACL access; create/link/replace/fsync/lock.")
    print("No containers started. Existing files and ACLs unchanged. Drafts were not read or mounted.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
