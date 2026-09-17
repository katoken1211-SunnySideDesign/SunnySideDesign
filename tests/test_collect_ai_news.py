import importlib.util
import json
from datetime import datetime, timezone
from pathlib import Path
import tempfile
import unittest


SPEC = importlib.util.spec_from_file_location(
    "collector", Path(__file__).resolve().parents[1] / "scripts/collect-ai-news.py")
collector = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(collector)
NOW = datetime(2026, 9, 17, 12, tzinfo=timezone.utc)
SOURCE = ("test", "https://example.com/rss.xml", "example.com")


def item(link="https://example.com/news/one", date="Thu, 17 Sep 2026 10:00:00 GMT"):
    return (f"<item><title>AI &amp; design</title><link>{link}</link>"
            f"<pubDate>{date}</pubDate><description><![CDATA[<p>Hello</p>"
            "<script>bad()</script><p>world</p>]]></description></item>")


def rss(*items):
    return ("<rss><channel>" + "".join(items) + "</channel></rss>").encode()


class CollectorTests(unittest.TestCase):
    def test_filter_and_sanitize(self):
        records, counts = collector.parse_feed(rss(
            item(), item(date="Mon, 01 Sep 2025 10:00:00 GMT"),
            item(date="Fri, 18 Sep 2026 10:00:00 GMT"),
            item(link="https://unofficial.example/news"),
            item(link="https://example.com/undated", date="bad date")), SOURCE, NOW, 7)
        self.assertEqual(len(records), 2)
        self.assertEqual(records[0]["title"], "AI & design")
        self.assertEqual(records[0]["excerpt"], "Hello world")
        self.assertIsNone(records[1]["published_at"])
        self.assertTrue(records[1]["date_needs_review"])
        self.assertEqual([counts[k] for k in ("old", "future", "invalid", "undated")], [1, 1, 1, 1])

    def test_guid_fallback(self):
        data = rss('<item><title>News</title><guid isPermaLink="true">https://example.com/a</guid></item>')
        records, _ = collector.parse_feed(data, SOURCE, NOW, 7)
        self.assertEqual(records[0]["url"], "https://example.com/a")

    def test_tracking_dedup_and_existing_preservation(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory)
            data = rss(item(), item(link="https://example.com/news/one?utm_source=rss#top"))
            run = lambda: collector.collect(output, sources=(SOURCE,), fetch=lambda *_: data, now=NOW)
            first = run()
            path = next((output / "items").glob("*.json"))
            original = path.read_bytes()
            second = run()
            self.assertEqual(first["sources"][0]["new"], 1)
            self.assertEqual(second["sources"][0]["new"], 0)
            self.assertEqual(second["sources"][0]["existing"], 2)
            self.assertEqual(path.read_bytes(), original)
            self.assertEqual(len(list((output / "runs").glob("*.json"))), 2)

    def test_dry_run_writes_nothing(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "absent"
            report = collector.collect(output, dry_run=True, sources=(SOURCE,),
                                       fetch=lambda *_: rss(item()), now=NOW)
            self.assertEqual(report["sources"][0]["new"], 1)
            self.assertFalse(output.exists())

    def test_failure_isolated_and_recorded(self):
        broken = ("broken", "https://broken.example/rss", "broken.example")
        def fetch(url, host):
            if host == "broken.example":
                raise TimeoutError("timed out")
            return rss(item())
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory)
            report = collector.collect(output, sources=(broken, SOURCE), fetch=fetch, now=NOW)
            self.assertEqual(report["status"], "error")
            self.assertIn("TimeoutError", report["sources"][0]["error"])
            self.assertEqual(report["sources"][1]["new"], 1)
            stored = json.loads(next((output / "runs").glob("*.json")).read_text())
            self.assertEqual(stored, report)

    def test_rejects_bad_xml_and_entities(self):
        for data in (b"<html>not RSS</html>", b"<rss>", rss(),
                     b'<!DOCTYPE rss [<!ENTITY x "injected">]><rss><channel/></rss>',
                     '<!DOCTYPE rss><rss/>'.encode("utf-16")):
            with self.subTest(data=data), self.assertRaises(ValueError if b"<rss>" != data else collector.ET.ParseError):
                collector.parse_feed(data, SOURCE, NOW, 7)

    def test_rejects_official_host_escape(self):
        for url in ("http://example.com/a", "https://example.com.evil/a",
                    "https://user:secret@example.com/a", "https://example.com:444/a"):
            with self.subTest(url=url), self.assertRaises(ValueError):
                collector.canonical_url(url, "example.com")
        redirect = collector.OfficialRedirects("example.com")
        with self.assertRaises(ValueError):
            redirect.redirect_request(None, None, 302, "", {}, "https://evil.example/rss")

    def test_atomic_writer_does_not_overwrite(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "item.json"
            self.assertTrue(collector.write_new_json(path, {"original": True}))
            self.assertFalse(collector.write_new_json(path, {"replacement": True}))
            self.assertEqual(json.loads(path.read_text()), {"original": True})
            self.assertEqual(len(list(Path(directory).iterdir())), 1)

    def test_symlink_output_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "link"
            output.symlink_to(directory, target_is_directory=True)
            with self.assertRaises(ValueError):
                collector.collect(output, sources=())


if __name__ == "__main__":
    unittest.main()
