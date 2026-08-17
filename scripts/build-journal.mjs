import { promises as fs } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const baseUrl = "https://sunnyside-d.com";
const sourceDir = path.join(root, "content/journal");
const required = ["title", "date", "category", "excerpt", "author", "slug"];
const categories = ["AI活用", "デザイン", "Web制作", "働き方・思考", "暮らし"];

const escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const escapeXml = escapeHtml;

function parseValue(raw) {
  const value = raw.trim().replace(/^(["'])(.*)\1$/, "$2");
  if (value === "true") return true;
  if (value === "false") return false;
  return value;
}

function parsePost(filename, source) {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) throw new Error(`${filename}: Front Matterがありません`);
  const data = {};
  for (const line of match[1].split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith("#")) continue;
    const divider = line.indexOf(":");
    if (divider < 1) throw new Error(`${filename}: Front Matterを解析できません: ${line}`);
    data[line.slice(0, divider).trim()] = parseValue(line.slice(divider + 1));
  }
  for (const key of required) if (!data[key]) throw new Error(`${filename}: ${key} は必須です`);
  if (!categories.includes(data.category)) throw new Error(`${filename}: categoryは ${categories.join(" / ")} のいずれかです`);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(data.slug)) throw new Error(`${filename}: slugは半角英小文字・数字・ハイフンのみ使用できます`);
  return { ...data, body: match[2].trim(), filename };
}

function inline(text) {
  let out = escapeHtml(text);
  out = out.replace(/!\[([^\]]*)\]\(([^ )]+)(?:\s+"([^"]*)")?\)/g, '<img src="$2" alt="$1" loading="lazy">');
  out = out.replace(/\[([^\]]+)\]\(([^ )]+)\)/g, '<a href="$2">$1</a>');
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/`([^`]+)`/g, "<code>$1</code>");
  return out;
}

function markdown(source) {
  const lines = source.split(/\r?\n/);
  let html = "", paragraph = [], list = null, quote = [], code = null, table = [];
  const flushParagraph = () => { if (paragraph.length) html += `<p>${inline(paragraph.join(" "))}</p>\n`; paragraph = []; };
  const flushList = () => { if (list) html += `<${list.type}>${list.items.map((x) => `<li>${inline(x)}</li>`).join("")}</${list.type}>\n`; list = null; };
  const flushQuote = () => { if (quote.length) html += `<blockquote><p>${inline(quote.join(" "))}</p></blockquote>\n`; quote = []; };
  const flushTable = () => { if (table.length) { const rows = table.filter((r) => !r.every((c) => /^:?-+:?$/.test(c))); const head = rows.shift() || []; html += `<div class="table-wrap"><table><thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>\n`; table = []; } };
  const flush = () => { flushParagraph(); flushList(); flushQuote(); flushTable(); };
  for (const line of lines) {
    if (code) { if (line.startsWith("```")) { html += `<pre><code>${escapeHtml(code.lines.join("\n"))}</code></pre>\n`; code = null; } else code.lines.push(line); continue; }
    if (line.startsWith("```")) { flush(); code = { lines: [] }; continue; }
    const heading = line.match(/^(#{2,3})\s+(.+)$/); if (heading) { flush(); const level = heading[1].length; html += `<h${level}>${inline(heading[2])}</h${level}>\n`; continue; }
    if (/^>\s?/.test(line)) { flushParagraph(); flushList(); flushTable(); quote.push(line.replace(/^>\s?/, "")); continue; } else flushQuote();
    if (/^\|.*\|\s*$/.test(line)) { flushParagraph(); flushList(); table.push(line.slice(1, -1).split("|").map((x) => x.trim())); continue; } else flushTable();
    const bullet = line.match(/^[-*]\s+(.+)$/); const numbered = line.match(/^\d+\.\s+(.+)$/);
    if (bullet || numbered) { flushParagraph(); const type = bullet ? "ul" : "ol"; if (list && list.type !== type) flushList(); list ||= { type, items: [] }; list.items.push((bullet || numbered)[1]); continue; } else flushList();
    if (!line.trim()) flushParagraph(); else paragraph.push(line.trim());
  }
  flush();
  if (code) throw new Error("閉じられていないコードブロックがあります");
  return html;
}

const dateJa = (date) => new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "long", day: "numeric", timeZone: "Asia/Tokyo" }).format(new Date(`${date}T00:00:00+09:00`));
const card = (post) => `<article class="journal-card" data-category="${escapeHtml(post.category)}"><a href="/journal/${post.slug}/">${post.image ? `<img class="journal-card-image" src="${escapeHtml(post.image)}" alt="" width="640" height="360" loading="lazy">` : '<span class="journal-card-image"></span>'}<div class="journal-card-body"><div class="journal-meta"><span class="journal-category">${escapeHtml(post.category)}</span><time datetime="${post.date}">${dateJa(post.date)}</time></div><h3>${escapeHtml(post.title)}</h3><p>${escapeHtml(post.excerpt)}</p></div></a></article>`;

function page(post, related) {
  const url = `${baseUrl}/journal/${post.slug}/`, image = post.image ? new URL(post.image, baseUrl).href : `${baseUrl}/assets/images/new-ogp.png`;
  const modified = post.updated || post.date;
  const articleJson = { "@context": "https://schema.org", "@type": "BlogPosting", headline: post.title, datePublished: post.date, dateModified: modified, author: { "@type": "Person", name: post.author }, image: [image], mainEntityOfPage: { "@type": "WebPage", "@id": url }, publisher: { "@type": "Organization", name: "SunnySideDesign", url: baseUrl } };
  const breadcrumbJson = { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "SunnySideDesign", item: `${baseUrl}/` }, { "@type": "ListItem", position: 2, name: "Journal", item: `${baseUrl}/journal/` }, { "@type": "ListItem", position: 3, name: post.title, item: url }] };
  return `<!DOCTYPE html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(post.title)} | Sunny Side Journal | SunnySideDesign</title><meta name="description" content="${escapeHtml(post.excerpt)}"><link rel="canonical" href="${url}">${post.draft ? '<meta name="robots" content="noindex, nofollow">' : ''}<meta property="og:title" content="${escapeHtml(post.title)}"><meta property="og:description" content="${escapeHtml(post.excerpt)}"><meta property="og:type" content="article"><meta property="og:url" content="${url}"><meta property="og:image" content="${image}"><meta property="article:published_time" content="${post.date}"><meta property="article:modified_time" content="${modified}"><meta name="twitter:card" content="summary_large_image"><link rel="icon" href="/assets/images/favicon.png"><link href="https://fonts.googleapis.com/css2?family=Poppins:wght@600;700&family=Noto+Sans+JP:wght@400;500;700&family=Caveat:wght@400;700&display=swap" rel="stylesheet"><link rel="stylesheet" href="/assets/css/style.css?v=20260813"><link rel="stylesheet" href="/assets/css/journal.css?v=20260813"><script type="application/ld+json">${JSON.stringify(articleJson).replace(/</g, "\\u003c")}</script><script type="application/ld+json">${JSON.stringify(breadcrumbJson).replace(/</g, "\\u003c")}</script><script defer src="/assets/js/script.js?v=20260813"></script></head><body class="journal-page">${post.draft ? '<div class="draft-notice">下書きプレビュー：公開一覧・sitemap・RSSには表示されません</div>' : ''}<header class="site-header"><div class="container header-inner"><a href="/" class="site-logo" aria-label="SunnySideDesign トップへ"><img src="/assets/images/logo.png" alt="SunnySideDesign"></a><nav class="site-nav" aria-label="メインナビゲーション"><a href="/">HOME</a><a href="/#service">SERVICE</a><a href="/#works">WORKS</a><a href="/journal/" aria-current="page">JOURNAL</a><a href="/#about">ABOUT</a><a href="https://form.run/@katoken--DCLxp2OJVIQHwiocLk83" target="_blank" rel="noopener noreferrer">CONTACT</a></nav><button class="menu-toggle" aria-expanded="false" aria-label="メニューを開く"><span></span><span></span></button></div></header><main><nav class="breadcrumb container" aria-label="パンくず"><ol><li><a href="/">SunnySideDesign</a></li><li><a href="/journal/">Journal</a></li><li aria-current="page">${escapeHtml(post.title)}</li></ol></nav><header class="article-header"><div class="container article-header-inner"><div class="journal-meta"><span class="journal-category">${escapeHtml(post.category)}</span><time datetime="${post.date}">公開 ${dateJa(post.date)}</time>${post.updated ? `<time datetime="${post.updated}">更新 ${dateJa(post.updated)}</time>` : ""}<span>著者 ${escapeHtml(post.author)}</span></div><h1>${escapeHtml(post.title)}</h1><p class="article-lead">${escapeHtml(post.excerpt)}</p></div>${post.image ? `<img class="article-cover" src="${escapeHtml(post.image)}" alt="${escapeHtml(post.title)}のアイキャッチ" width="1200" height="630">` : ""}</header><div class="article-layout"><article class="article-body">${markdown(post.body)}</article><div class="article-after"><div class="author-panel"><img src="/assets/images/profile-icon.png" alt="katokenのプロフィール画像" width="96" height="96" loading="lazy"><div><span class="journal-eyebrow">Author</span><h2>katoken</h2><p class="author-role">営業マン × デザイナー × AIエンジニア</p><p>SunnySideDesign代表。制作とAI活用の実践から得た気づきを発信しています。</p></div></div>${related.length ? `<section class="journal-section"><div class="journal-section-head"><div><span class="journal-eyebrow">Related</span><h2 class="journal-heading">関連記事</h2></div></div><div class="journal-grid">${related.map(card).join("")}</div></section>` : ""}<div class="article-actions"><a class="outline-btn" href="/journal/">Journalトップへ戻る →</a><a class="primary-btn" href="https://form.run/@katoken--DCLxp2OJVIQHwiocLk83" target="_blank" rel="noopener noreferrer">制作について相談する →</a></div></div></div></main><footer class="site-footer"><div class="container footer-inner"><div class="footer-left"><a href="/"><img src="/assets/images/logo.png" alt="SunnySideDesign"></a></div><nav class="footer-nav"><a href="/">HOME</a><a href="/#service">SERVICE</a><a href="/#works">WORKS</a><a href="/journal/">JOURNAL</a><a href="/#about">ABOUT</a></nav></div><div class="copyright">© SunnySideDesign All Rights Reserved.</div></footer></body></html>`;
}

function replaceBlock(source, name, content) {
  const re = new RegExp(`<!-- ${name}_START -->[\\s\\S]*?<!-- ${name}_END -->`);
  if (!re.test(source)) throw new Error(`${name} の生成マーカーが見つかりません`);
  return source.replace(re, `<!-- ${name}_START -->${content}<!-- ${name}_END -->`);
}

const files = (await fs.readdir(sourceDir)).filter((x) => x.endsWith(".md"));
const posts = await Promise.all(files.map(async (file) => parsePost(file, await fs.readFile(path.join(sourceDir, file), "utf8"))));
const slugs = new Set(); for (const post of posts) { if (slugs.has(post.slug)) throw new Error(`slugが重複しています: ${post.slug}`); slugs.add(post.slug); }
posts.sort((a, b) => b.date.localeCompare(a.date));
const published = posts.filter((post) => !post.draft);
for (const post of posts) {
  const output = path.join(root, "journal", post.slug);
  const related = published.filter((x) => x.slug !== post.slug && x.category === post.category).slice(0, 3);
  const html = page(post, related)
    .replace("journal.css?v=20260813", "journal.css?v=20260816")
    .replace('</head>', '<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-2801111628934180" crossorigin="anonymous"></script></head>')
    .replace('<a href="/#about">ABOUT</a></nav>', '<a href="/#about">ABOUT</a><a href="/privacy/">PRIVACY POLICY</a></nav>');
  await fs.mkdir(output, { recursive: true });
  await fs.writeFile(path.join(output, "index.html"), html);
}

let journalIndex = await fs.readFile(path.join(root, "journal/index.html"), "utf8");
journalIndex = replaceBlock(journalIndex, "JOURNAL_FEATURED", published.filter((x) => x.featured).slice(0, 3).length ? `<div class="journal-grid">${published.filter((x) => x.featured).slice(0, 3).map(card).join("")}</div>` : '<div class="journal-empty"><div><strong>おすすめ記事を準備しています</strong><p>公開後、特に読んでいただきたい記事をここでご紹介します。</p></div></div>');
journalIndex = replaceBlock(journalIndex, "JOURNAL_LATEST", published.length ? `<div class="journal-grid">${published.map(card).join("")}</div>` : '<div class="journal-empty"><div><strong>最初の記事を準備しています</strong><p>SunnySideDesignの実体験と考え方を、ここから少しずつ蓄積していきます。</p></div></div>');
await fs.writeFile(path.join(root, "journal/index.html"), journalIndex);

let home = await fs.readFile(path.join(root, "index.html"), "utf8");
home = replaceBlock(home, "JOURNAL_HOME", published.length ? `<div class="journal-grid">${published.slice(0, 3).map(card).join("")}</div>` : '<div class="home-journal-empty"><span aria-hidden="true">✦</span><p>最初の記事を準備しています。SunnySideDesignの試行錯誤を、ここから少しずつお届けします。</p></div>');
await fs.writeFile(path.join(root, "index.html"), home);

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${baseUrl}/</loc></url>\n  <url><loc>${baseUrl}/journal/</loc><lastmod>${new Date().toISOString().slice(0, 10)}</lastmod></url>\n${published.map((p) => `  <url><loc>${baseUrl}/journal/${p.slug}/</loc><lastmod>${p.updated || p.date}</lastmod></url>`).join("\n")}\n</urlset>\n`;
const sitemapWithPrivacy = sitemap.replace(
  `  <url><loc>${baseUrl}/</loc></url>\n`,
  `  <url><loc>${baseUrl}/</loc></url>\n  <url><loc>${baseUrl}/privacy/</loc></url>\n`,
);
await fs.writeFile(path.join(root, "sitemap.xml"), sitemapWithPrivacy);
const rss = `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel><title>Sunny Side Journal</title><link>${baseUrl}/journal/</link><description>AIとデザイン、暮らしの実践ノート。</description><language>ja</language>${published.map((p) => `<item><title>${escapeXml(p.title)}</title><link>${baseUrl}/journal/${p.slug}/</link><guid>${baseUrl}/journal/${p.slug}/</guid><pubDate>${new Date(`${p.date}T00:00:00+09:00`).toUTCString()}</pubDate><description>${escapeXml(p.excerpt)}</description></item>`).join("")}</channel></rss>\n`;
await fs.writeFile(path.join(root, "journal/rss.xml"), rss);
console.log(`Journal build complete: ${published.length} published, ${posts.length - published.length} draft`);
