# AI news inbox — phase 1

Python 3.11+ standard-library RSS collector. No installation, API keys, LLM,
article generation, publishing, scheduling, or Git operations are performed.

From the repository root:

```sh
# Preview real feeds without writing files
python3 -B scripts/collect-ai-news.py --dry-run

# Collect to /workspace/ai-news-inbox (outside the website repository)
python3 -B scripts/collect-ai-news.py

# Optional lookback/output override
python3 -B scripts/collect-ai-news.py --days 14 --output /tmp/ai-news-preview

# Offline tests; use temporary directories only
python3 -B -m unittest discover -s tests -p 'test_collect_ai_news.py' -v
```

Official feeds, verified by HTTP requests during implementation:

- OpenAI: https://openai.com/news/rss.xml
- Google AI: https://blog.google/innovation-and-ai/technology/ai/rss/
- Hugging Face: https://huggingface.co/blog/feed.xml
- NVIDIA AI/deep learning: https://blogs.nvidia.com/blog/category/deep-learning/feed/

These are vendor announcements/blog posts, including research and promotional
content; relevance ranking and independent fact verification are future work.
The collector retrieves only feeds, not linked articles or images. Feed text is
untrusted data, never instructions to execute.

## Output and behavior

- `items/<sha256-of-normalized-url>.json`: source, feed URL, article URL, title,
  publication date, first retrieval time, and up to 600 characters of plain-text
  feed excerpt. This is a source excerpt, not an AI summary or a Journal article.
- `runs/<UTC-time>-<unique-id>.json`: per-source counts/errors for each run.
- Default lookback: seven rolling days in UTC. Older and future-dated items are
  skipped. Missing/invalid/timezone-less dates are retained with
  `published_at: null` and `date_needs_review: true`; no date is invented.
- URL fragments and known tracking parameters are removed. Exact normalized
  URLs deduplicate across runs. Different URLs covering the same story are not
  semantically deduplicated. Existing item files are never updated or deleted;
  publisher revisions therefore require manual review.
- Writes are atomic and exclusive, including concurrent runs. Creation requests
  mode 700 for directories and 600 for JSON files; effective access depends on
  the host filesystem/ACLs. This workspace reports mode 000, so POSIX permission
  enforcement was not verified. Existing permissions are not changed. The inbox
  must remain outside any web-serving or deployment path.
- HTTPS and exact official hosts are required for feed redirects and article
  links. Each request uses a 15-second socket timeout and a 5 MB response limit.
  No automatic retries. Unsupported/empty/malformed feeds and XML DTD/entities
  fail explicitly; other feeds continue. Exit code 1 means at least one failure,
  possibly with successful items saved. Exit code 0 means all feeds parsed.
- `--dry-run` reads feeds and existing item paths, but creates no files or
  directories. Its `new` counts mean “would save.”
- Storage is append-only; there is no retention/deletion job. Review growth
  before enabling any future schedule.

## Journal boundary

The inbox is editorial research only. The current Journal builder renders
`draft: true` articles into HTML, so that flag is not a privacy boundary.
Do not automatically copy collected items to `content/journal/`. Any later
article needs source checks, the author's actual experience, the existing
Journal schema, validation, and human approval before merge/publication.
