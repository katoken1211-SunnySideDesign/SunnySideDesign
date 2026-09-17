"""Deployment guards shared by the scheduler and the UGOS host preflight."""

import os
from pathlib import Path
import re
import stat


DATA_SUBDIRS = ("items", "runs", "scheduler")


def numeric_id(value):
    if not re.fullmatch(r"[0-9]+", str(value)) or not 1 <= int(value) <= 2147483647:
        raise ValueError("UID and GID must be numeric, non-zero values (1–2147483647)")
    return int(value)


def enforce_identity(expected_uid=None, expected_gid=None):
    identities = (os.getuid(), os.geteuid(), os.getgid(), os.getegid(), *os.getgroups())
    if 0 in identities:
        raise ValueError("Root UID, GID, or supplementary group is forbidden")
    if expected_uid is not None and numeric_id(expected_uid) != os.geteuid():
        raise ValueError("Effective UID differs from AI_NEWS_UID")
    if expected_gid is not None and numeric_id(expected_gid) != os.getegid():
        raise ValueError("Effective GID differs from AI_NEWS_GID")


def canonical_directory(value):
    path = Path(value)
    if not path.is_absolute() or path != path.resolve() or not path.is_dir():
        raise ValueError(f"Use an existing absolute directory with no symlinks or '..': {path}")
    return path


def raise_walk_error(error):
    raise error


def validate_trees(root):
    """Never traverse drafts. Reject aliases that could expose external files."""
    root = canonical_directory(root)
    paths = [canonical_directory(root / name) for name in DATA_SUBDIRS]
    for path in paths:
        for folder, directories, files in os.walk(path, followlinks=False, onerror=raise_walk_error):
            for name in directories + files:
                entry = Path(folder) / name
                info = entry.lstat()
                if stat.S_ISLNK(info.st_mode):
                    raise ValueError(f"Symlinks are forbidden in mounted data: {entry}")
                if stat.S_ISREG(info.st_mode):
                    if info.st_nlink != 1:
                        raise ValueError(f"Hard-linked data files are forbidden: {entry}")
                elif not stat.S_ISDIR(info.st_mode):
                    raise ValueError(f"Non-regular data entry is forbidden: {entry}")
    return paths


def validate_container_mounts(root, mountinfo=None):
    root = canonical_directory(root)
    if mountinfo is None:
        mountinfo = Path("/proc/self/mountinfo").read_text()
    mounts = {}
    for line in mountinfo.splitlines():
        fields = line.split(" - ", 1)[0].split()
        target = re.sub(r"\\([0-7]{3})", lambda m: chr(int(m[1], 8)), fields[4])
        mounts[Path(target)] = set(fields[5].split(","))
    expected = {root / name for name in DATA_SUBDIRS}
    actual = {path for path in mounts if path == root or root in path.parents}
    if actual != expected or any("rw" not in mounts[path] for path in expected):
        raise ValueError("Mount only items, runs, scheduler as writable subdirectories; never the inbox parent or drafts")
    parent_mount = max((path for path in mounts if path in root.parents), key=lambda path: len(path.parts))
    if "ro" not in mounts[parent_mount]:
        raise ValueError("The container root filesystem must be read-only")
    if set(p.name for p in root.iterdir()) != set(DATA_SUBDIRS):
        raise ValueError("Unexpected content in container data root; drafts must not be exposed")


def permission_probe(paths):
    """As the service identity, check ACLs and required filesystem primitives.

    Only temporary probe files are created/removed. Existing data is not edited.
    This function is self-contained so the host can run it after dropping IDs.
    """
    import fcntl
    import os
    from pathlib import Path
    import tempfile

    def raise_walk_error(error):
        raise error

    for value in paths:
        path = Path(value)
        for folder, directories, files in os.walk(path, onerror=raise_walk_error):
            if not os.access(folder, os.R_OK | os.W_OK | os.X_OK, effective_ids=True):
                raise PermissionError(f"Directory is not readable/writable/searchable: {folder}")
            for name in files:
                target = Path(folder) / name
                required = os.R_OK | (os.W_OK if path.name == "scheduler" else 0)
                if not os.access(target, required, effective_ids=True):
                    raise PermissionError(f"Existing file is inaccessible: {target}")
        with tempfile.TemporaryDirectory(prefix=".ai-news-preflight-", dir=path) as directory:
            directory = Path(directory)
            first, linked, renamed = (directory / name for name in ("first", "linked", "renamed"))
            with first.open("x+") as stream:
                fcntl.flock(stream, fcntl.LOCK_EX | fcntl.LOCK_NB)
                stream.write("permission probe\n")
                stream.flush()
                os.fsync(stream.fileno())
                os.link(first, linked)
                os.replace(linked, renamed)
            fd = os.open(directory, os.O_RDONLY | os.O_DIRECTORY)
            try:
                os.fsync(fd)
            finally:
                os.close(fd)
    return True
