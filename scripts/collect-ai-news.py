#!/usr/bin/env python3
"""Collect official RSS metadata only; no generation or publishing. Python 3.11+."""

import argparse
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
import hashlib
from html.parser import HTMLParser
import json
import os
from pathlib import Path
import re
import tempfile
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener
import uuid
import xml.etree.ElementTree as ET


FEEDS = (
    ("openai", "https://openai.com/news/rss.xml", "openai.com"),
    ("google-ai", "https://blog.google/innovation-and-ai/technology/ai/rss/", "blog.google"),
    ("hugging-face", "https://huggingface.co/blog/feed.xml", "huggingface.co"),
    ("nvidia-ai", "https://blogs.nvidia.com/blog/category/deep-learning/feed/", "blogs.nvidia.com"),
)
DEFAULT_OUTPUT = Path("/workspace/ai-news-inbox")
MAX_BYTES = 5_000_000
TIMEOUT = 15


def official_url(url, host):
    parts = urlsplit(url)
    if (parts.scheme != "https" or parts.hostname != host
            or parts.username or parts.password or parts.port not in (None, 443)):
        raise ValueError("URL must use HTTPS on the source's official host")
    return parts


class OfficialRedirects(HTTPRedirectHandler):
    def __init__(self, host):
        self.host = host

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        official_url(newurl, self.host)
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def fetch_feed(url, host):
    official_url(url, host)
    request = Request(url, headers={
        "User-Agent": "SunnySideDesign-AINewsCollector/1.0",
        "Accept": "application/rss+xml, application/xml, text/xml",
        "Accept-Encoding": "identity",
    })
    with build_opener(OfficialRedirects(host)).open(request, timeout=TIMEOUT) as response:
        official_url(response.url, host)
        data = response.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        raise ValueError("Feed exceeds 5 MB limit")
    return data


class PlainText(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts = []
        self.hidden = 0

    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style"):
            self.hidden += 1

    def handle_endtag(self, tag):
        if tag in ("script", "style") and self.hidden:
            self.hidden -= 1

    def handle_data(self, data):
        if not self.hidden:
            self.parts.append(data)


def plain_text(value, limit):
    parser = PlainText()
    parser.feed(value)
    text = " ".join(" ".join(parser.parts).split())
    text = "".join(c for c in text if c.isprintable())
    return text[:limit]


def canonical_url(url, host):
    parts = official_url(url.strip(), host)
    query = [(k, v) for k, v in parse_qsl(parts.query, keep_blank_values=True)
             if not k.lower().startswith("utm_") and k.lower() not in ("fbclid", "gclid")]
    return urlunsplit(("https", host, parts.path or "/", urlencode(query), ""))


def publication_date(value):
    if not value:
        return None
    try:
        date = parsedate_to_datetime(value)
        if date.tzinfo is None:
            return None
        return date.astimezone(timezone.utc)
    except (ValueError, TypeError, OverflowError):
        return None


def parse_feed(data, source, now, days):
    # Reject DTD/entity declarations, including UTF-16/32 encodings.
    if len(data) > MAX_BYTES or re.search(br"<!\s*(DOCTYPE|ENTITY)\b", data.replace(b"\x00", b""), re.I):
        raise ValueError("Oversized feed or XML declarations not allowed")
    root = ET.fromstring(data)
    channel = root.find("channel")
    if root.tag != "rss" or channel is None:
        raise ValueError("Expected an RSS channel")
    items = channel.findall("item")
    if not items or len(items) > 5000:
        raise ValueError("Empty feed or excessive item count")
    source_id, feed_url, host = source
    records = []
    counts = {"items": len(items), "old": 0, "future": 0, "invalid": 0, "undated": 0}
    for item in items:
        title = plain_text(item.findtext("title", ""), 500)
        link = item.findtext("link", "").strip()
        if not link:
            guid = item.find("guid")
            if guid is not None and guid.get("isPermaLink", "true").lower() == "true":
                link = guid.text or ""
        try:
            url = canonical_url(link, host)
            if not title:
                raise ValueError("Missing title")
        except ValueError:
            counts["invalid"] += 1
            continue
        raw_date = item.findtext("pubDate", "").strip()
        published = publication_date(raw_date)
        if published and published > now:
            counts["future"] += 1
            continue
        if published and published < now - timedelta(days=days):
            counts["old"] += 1
            continue
        if published is None:
            counts["undated"] += 1
        records.append({
            "schema_version": 1,
            "id": hashlib.sha256(url.encode()).hexdigest(),
            "source": source_id,
            "feed_url": feed_url,
            "url": url,
            "title": title,
            "published_at": published.isoformat() if published else None,
            "published_raw": raw_date[:200],
            "date_needs_review": published is None,
            "retrieved_at": now.isoformat(),
            "excerpt": plain_text(item.findtext("description", ""), 600),
        })
    if counts["invalid"] == len(items):
        raise ValueError("Feed contains no valid official article links")
    return records, counts


def write_new_json(path, value):
    """Atomically create a complete JSON file, never replace an existing file."""
    with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=path.parent,
                                     prefix=".collect-", delete=False) as temp:
        temporary = Path(temp.name)
        try:
            json.dump(value, temp, ensure_ascii=False, indent=2)
            temp.write("\n")
            temp.flush()
            os.fsync(temp.fileno())
        except BaseException:
            temporary.unlink()
            raise
    try:
        os.link(temporary, path)
        return True
    except FileExistsError:
        return False
    finally:
        temporary.unlink()


def collect(output, days=7, dry_run=False, sources=FEEDS, fetch=fetch_feed, now=None):
    now = now or datetime.now(timezone.utc)
    output = Path(output)
    report = {"schema_version": 1, "started_at": now.isoformat(), "days": days,
              "dry_run": dry_run, "output": str(output), "sources": []}
    if not dry_run:
        for folder in (output, output / "items", output / "runs"):
            if folder.is_symlink():
                raise ValueError(f"Refusing symlink output directory: {folder}")
            folder.mkdir(mode=0o700, parents=True, exist_ok=True)
    seen = set()
    for source in sources:
        status = {"source": source[0], "feed_url": source[1], "status": "ok",
                  "new": 0, "existing": 0}
        try:
            records, counts = parse_feed(fetch(source[1], source[2]), source, now, days)
            status.update(counts)
            for record in records:
                path = output / "items" / (record["id"] + ".json")
                if record["id"] in seen or path.exists() or path.is_symlink():
                    status["existing"] += 1
                elif dry_run or write_new_json(path, record):
                    status["new"] += 1
                else:
                    status["existing"] += 1
                seen.add(record["id"])
        except Exception as error:
            status.update(status="error", error=f"{type(error).__name__}: {error}"[:1000])
        report["sources"].append(status)
    report["status"] = "error" if any(s["status"] == "error" for s in report["sources"]) else "ok"
    if not dry_run:
        name = now.strftime("%Y%m%dT%H%M%SZ") + "-" + uuid.uuid4().hex + ".json"
        write_new_json(output / "runs" / name, report)
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--days", type=int, default=7, help="Lookback in days (1–3650; default 7)")
    parser.add_argument("--dry-run", action="store_true", help="Fetch and report without writing anything")
    args = parser.parse_args()
    if not 1 <= args.days <= 3650:
        parser.error("--days must be between 1 and 3650")
    try:
        report = collect(args.output, args.days, args.dry_run)
    except (OSError, ValueError) as error:
        parser.exit(1, f"Collector failed: {error}\n")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if report["status"] == "ok" else 1


if __name__ == "__main__":
    raise SystemExit(main())
