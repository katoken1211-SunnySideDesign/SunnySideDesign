from contextlib import ExitStack
import importlib.util
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import ai_news_safety as safety

SPEC = importlib.util.spec_from_file_location("preflight", ROOT / "scripts/preflight-ai-news.py")
preflight = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(preflight)


class PreflightTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.workspace = Path(self.temp.name)
        self.inbox = self.workspace / "ai-news-inbox"
        self.inbox.mkdir()
        self.paths = [self.inbox / name for name in safety.DATA_SUBDIRS]
        for path in self.paths:
            path.mkdir()
        self.env = self.workspace / "settings.env"
        self.env.write_text(f"AI_NEWS_INBOX_DIR={self.inbox}\nAI_NEWS_UID=65534\nAI_NEWS_GID=65534\n")
        self.settings = {"AI_NEWS_INBOX_DIR": str(self.inbox), "AI_NEWS_UID": "65534", "AI_NEWS_GID": "65534"}
        self.environment = patch.dict(os.environ, {}, clear=True)
        self.environment.start()
        self.addCleanup(self.environment.stop)

    def test_ids_reject_root_names_placeholders_and_out_of_range(self):
        for value in ("0", "000", "-1", "user", "REPLACE_WITH_UID", "1.0", "", "2147483648"):
            with self.subTest(value=value), self.assertRaises(ValueError):
                safety.numeric_id(value)
        self.assertEqual(safety.numeric_id("65534"), 65534)

    def test_identity_rejects_root_in_any_id_or_group(self):
        names = ("getuid", "geteuid", "getgid", "getegid", "getgroups")
        for root_at in names:
            with self.subTest(root_at=root_at), ExitStack() as stack:
                for name in names:
                    value = [1001] if name == "getgroups" else 1001
                    if name == root_at:
                        value = [0, 1001] if name == "getgroups" else 0
                    stack.enter_context(patch.object(safety.os, name, return_value=value))
                with self.assertRaisesRegex(ValueError, "Root"):
                    safety.enforce_identity()

    def test_identity_must_match_configured_uid_and_gid(self):
        with ExitStack() as stack:
            for name in ("getuid", "geteuid", "getgid", "getegid"):
                stack.enter_context(patch.object(safety.os, name, return_value=1001))
            stack.enter_context(patch.object(safety.os, "getgroups", return_value=[1001]))
            safety.enforce_identity("1001", "1001")
            for uid, gid in (("1002", "1001"), ("1001", "1002"), ("0", "1001")):
                with self.subTest(uid=uid, gid=gid), self.assertRaises(ValueError):
                    safety.enforce_identity(uid, gid)

    def test_env_literals_and_override_detection(self):
        self.assertEqual(preflight.read_settings(self.env), self.settings)
        self.env.write_text(f"# Local configuration\nAI_NEWS_INBOX_DIR='{self.inbox}'\nAI_NEWS_UID=65534\nAI_NEWS_GID=65534\n")
        self.assertEqual(preflight.read_settings(self.env), self.settings)
        with patch.dict(os.environ, {"AI_NEWS_UID": "0"}):
            with self.assertRaisesRegex(ValueError, "overrides"):
                preflight.read_settings(self.env)

    def test_invalid_env_fails_before_host_probe(self):
        original = self.env.read_text()
        variants = [original + "AI_NEWS_UID=1\n", original + "OTHER=value\n",
                    original.replace("AI_NEWS_GID=65534", "AI_NEWS_GID=0"),
                    original.replace("AI_NEWS_UID=65534", "AI_NEWS_UID=${UID}"),
                    original.replace("AI_NEWS_UID=65534", "AI_NEWS_UID=REPLACE_WITH_UID"),
                    original.replace("AI_NEWS_GID=65534\n", "")]
        for data in variants:
            with self.subTest(data=data):
                self.env.write_text(data)
                with self.assertRaises(ValueError):
                    preflight.read_settings(self.env)

    def test_extra_host_groups_cannot_make_preflight_pass(self):
        with patch.object(preflight.os, "geteuid", return_value=1001), \
                patch.object(preflight, "enforce_identity"), \
                patch.object(preflight.os, "getgroups", return_value=[1001, 1002]), \
                patch.object(preflight.subprocess, "run") as run:
            with self.assertRaisesRegex(ValueError, "Extra host groups"):
                preflight.probe_as_service(self.paths, "1001", "1001")
            run.assert_not_called()

    def test_host_paths_must_match_verified_workspace(self):
        self.assertEqual(preflight.check_host_paths(self.settings, self.workspace), self.paths)
        for value in (str(self.workspace), "ai-news-inbox", str(self.workspace / "absent")):
            with self.subTest(value=value), self.assertRaises(ValueError):
                preflight.check_host_paths({**self.settings, "AI_NEWS_INBOX_DIR": value}, self.workspace)
        with self.assertRaises(ValueError):
            preflight.check_host_paths(self.settings, self.inbox)

    def test_missing_child_mount_path_is_not_created(self):
        self.paths[2].rmdir()
        with self.assertRaises(ValueError):
            preflight.check_host_paths(self.settings, self.workspace)
        self.assertFalse(self.paths[2].exists())

    def test_symlinked_parent_or_child_is_rejected(self):
        alias = self.workspace / "alias"
        alias.symlink_to(self.inbox, target_is_directory=True)
        with self.assertRaises(ValueError):
            safety.validate_trees(alias)
        self.paths[2].rmdir()
        self.paths[2].symlink_to(self.paths[0], target_is_directory=True)
        with self.assertRaises(ValueError):
            safety.validate_trees(self.inbox)

    def test_draft_symlink_and_hardlink_in_mounted_data_are_rejected(self):
        draft = self.workspace / "draft.md"
        draft.write_text("private original draft")
        alias = self.paths[0] / "aliased-draft"
        alias.symlink_to(draft)
        with self.assertRaisesRegex(ValueError, "Symlinks"):
            safety.validate_trees(self.inbox)
        alias.unlink()
        os.link(draft, alias)
        with self.assertRaisesRegex(ValueError, "Hard-linked"):
            safety.validate_trees(self.inbox)
        self.assertEqual(draft.read_text(), "private original draft")

    def test_special_files_are_rejected(self):
        os.mkfifo(self.paths[1] / "pipe")
        with self.assertRaisesRegex(ValueError, "Non-regular"):
            safety.validate_trees(self.inbox)

    def test_probe_preserves_data_and_ignores_unmounted_drafts(self):
        draft_dir = self.inbox / "drafts"
        draft_dir.mkdir()
        draft = draft_dir / "saved.md"
        draft.write_bytes(b"private draft\n")
        item = self.paths[0] / "existing.json"
        item.write_bytes(b'{"title":"existing"}\n')
        # An alias in drafts would fail validation if that tree were traversed.
        (draft_dir / "not-for-collector").symlink_to(self.paths[0], target_is_directory=True)
        before = {p: (p.read_bytes(), p.stat().st_mtime_ns, p.stat().st_mode) for p in (draft, item)}
        safety.permission_probe(safety.validate_trees(self.inbox))
        self.assertEqual(before, {p: (p.read_bytes(), p.stat().st_mtime_ns, p.stat().st_mode) for p in (draft, item)})
        self.assertEqual(list(self.paths[0].iterdir()), [item])
        self.assertEqual(list(self.paths[1].iterdir()), [])
        self.assertEqual(list(self.paths[2].iterdir()), [])

    @unittest.skipUnless(os.geteuid() == 0, "Dropping to a separate UID/GID requires root")
    def test_actual_nonroot_probe_passes_then_rejects_directory_and_file_permissions(self):
        # Fixture modes only. This never touches the NAS inbox or host ACLs.
        self.workspace.chmod(0o755)
        self.inbox.chmod(0o755)
        for path in self.paths:
            path.chmod(0o777)
        preflight.probe_as_service(self.paths, "65534", "65534")
        self.paths[0].chmod(0o755)
        with self.assertRaisesRegex(PermissionError, "Directory is not"):
            preflight.probe_as_service(self.paths, "65534", "65534")
        self.paths[0].chmod(0o777)
        locked_file = self.paths[2] / "state.json"
        locked_file.write_text("fixture")
        locked_file.chmod(0o600)
        with self.assertRaisesRegex(PermissionError, "Existing file is inaccessible"):
            preflight.probe_as_service(self.paths, "65534", "65534")
        self.assertEqual(locked_file.read_text(), "fixture")

    def mountinfo(self, root_mode="ro", extra=(), omit=()):
        entries = [("/", root_mode)] + [(str(path), "rw") for path in self.paths if path.name not in omit] + list(extra)
        return "\n".join(f"{index + 1} 0 0:1 / {path} {mode},relatime - ext4 /dev/test {mode}" for index, (path, mode) in enumerate(entries))

    def test_runtime_requires_three_child_mounts_and_readonly_parent(self):
        safety.validate_container_mounts(self.inbox, self.mountinfo())
        bad = [self.mountinfo("rw"), self.mountinfo(omit=("scheduler",)),
               self.mountinfo(extra=((str(self.inbox), "rw"),)),
               self.mountinfo(extra=((str(self.inbox / "drafts"), "rw"),))]
        for info in bad:
            with self.subTest(info=info), self.assertRaises(ValueError):
                safety.validate_container_mounts(self.inbox, info)
        (self.inbox / "drafts").mkdir()
        with self.assertRaisesRegex(ValueError, "Unexpected content"):
            safety.validate_container_mounts(self.inbox, self.mountinfo())

    def test_workspace_inspection_only_reads_existing_container(self):
        result = subprocess.CompletedProcess([], 0, stdout='[{"Type":"bind","Destination":"/workspace","Source":"/volume/Development"}]')
        with patch.object(preflight.subprocess, "run", return_value=result) as run:
            self.assertEqual(preflight.workspace_source(), "/volume/Development")
        self.assertEqual(run.call_args.args[0], ["docker", "inspect", "codex-agent", "--format", "{{json .Mounts}}"])

    @unittest.skipUnless(os.geteuid() == 0, "Root entrypoint rejection requires a root test process")
    def test_scheduler_root_override_fails_before_writes_or_collection(self):
        missing = self.workspace / "must-not-create"
        result = subprocess.run([sys.executable, "-B", str(ROOT / "scripts/schedule-ai-news.py"),
                                 "--data-dir", str(missing)], capture_output=True, text=True, timeout=5)
        self.assertEqual(result.returncode, 1)
        self.assertIn("Root UID", result.stderr)
        self.assertFalse(missing.exists())


if __name__ == "__main__":
    unittest.main()
