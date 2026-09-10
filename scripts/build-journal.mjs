import { promises as fs } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

const root = path.resolve(import.meta.dirname, "..");
const baseUrl = "https://sunnyside-d.com";
const sourceDir = path.join(root, "content/journal");
const required = ["title", "date", "category", "excerpt", "author", "slug"];
const categoryDefinitions = [
  { name: "AI活用", slug: "ai", description: "AIを仕事や暮らしの中で実際に使いながら、試したことや気づいたことを紹介します。" },
  { name: "デザイン", slug: "design", description: "デザイン制作やブランディング、制作プロセスについて紹介します。" },
  { name: "Web制作", slug: "web", description: "Webサイト制作や運用、改善について紹介します。" },
  { name: "働き方・思考", slug: "work", description: "AI・デザイン・仕事を通して考えた、働き方や学びを紹介します。" },
  { name: "暮らし", slug: "life", description: "AIやデザインを家族との日常に活かした工夫や、暮らしの中での気づきを紹介します。" },
];
const categories = categoryDefinitions.map((category) => category.name);
const featuredSlugs = ["claude-code-codex-workstyle", "planning-disneyland-with-ai", "why-i-started-sunnyside-design"];
const args = process.argv.slice(2);
const check = args.includes("--check");
const slugIndex = args.indexOf("--slug");
const selectedSlug = slugIndex >= 0 ? args[slugIndex + 1] : null;
if (slugIndex >= 0 && (!selectedSlug || selectedSlug.startsWith("--"))) throw new Error("--slug にはslugを指定してください");
const unknownArgs = args.filter((arg, index) => arg !== "--check" && arg !== "--slug" && index !== slugIndex + 1);
if (unknownArgs.length) throw new Error(`不明なオプションです: ${unknownArgs.join(", ")}`);
const changedFiles = [];
const mismatchedFiles = [];

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
  for (const key of ["date", "updated"]) if (data[key] !== undefined && !isValidDate(data[key])) throw new Error(`${filename}: ${key} は実在する日付をYYYY-MM-DD形式で指定してください`);
  if (data.updated && data.updated < data.date) throw new Error(`${filename}: updated は date 以降の日付にしてください`);
  for (const key of ["title", "category", "excerpt", "author", "slug", "image"]) if (data[key] !== undefined && typeof data[key] !== "string") throw new Error(`${filename}: ${key} は文字列で指定してください`);
  for (const key of ["featured", "draft"]) if (data[key] !== undefined && typeof data[key] !== "boolean") throw new Error(`${filename}: ${key} はtrueまたはfalseで指定してください`);
  return { ...data, body: match[2].trim(), filename };
}

function isValidDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function prettyHtml(source) {
  const blocks = "html|head|body|main|header|footer|nav|section|article|aside|div|ol|ul|li|h1|h2|h3|p|blockquote|pre|table|thead|tbody|tr|script";
  return `<!-- AUTO-GENERATED: DO NOT EDIT DIRECTLY -->\n${source.replace(new RegExp(`><(?=/?(?:${blocks})(?:\\s|>))`, "g"), ">\n<").replace(/<\/(head|body|html)>/g, "</$1>\n").replace(/\n{2,}/g, "\n").trim()}\n`;
}

async function writeIfChanged(relativePath, content) {
  const target = path.join(root, relativePath);
  let current = null;
  try { current = await fs.readFile(target, "utf8"); } catch (error) { if (error.code !== "ENOENT") throw error; }
  if (current === content) return;
  (check ? mismatchedFiles : changedFiles).push(relativePath);
  if (!check) { await fs.mkdir(path.dirname(target), { recursive: true }); await fs.writeFile(target, content); }
}

async function validateImages(posts) {
  for (const post of posts) {
    const references = [post.image, ...[...post.body.matchAll(/!\[[^\]]*\]\(([^ )]+)(?:\s+"[^"]*")?\)/g)].map((match) => match[1])].filter(Boolean);
    for (const reference of references) {
      if (/^(?:https?:)?\/\//i.test(reference) || reference.startsWith("data:")) continue;
      let pathname;
      try { pathname = decodeURIComponent(reference.split(/[?#]/, 1)[0]); } catch { throw new Error(`${post.filename}: invalid image reference: ${reference}`); }
      const target = path.join(root, pathname.replace(/^\//, ""));
      try { await fs.access(target); } catch { throw new Error(`${post.filename}: image reference missing: ${reference}`); }
    }
  }
  const imageRoot = path.join(root, "assets/images/journal");
  const entries = (await fs.readdir(imageRoot, { withFileTypes: true })).filter((entry) => entry.isFile() && entry.name !== "README.md");
  const hashes = new Map();
  for (const entry of entries) {
    const digest = createHash("sha256").update(await fs.readFile(path.join(imageRoot, entry.name))).digest("hex");
    hashes.set(digest, [...(hashes.get(digest) || []), entry.name]);
  }
  const duplicates = [...hashes.values()].filter((names) => names.length > 1);
  if (duplicates.length) throw new Error(`Duplicate image content detected:\n${duplicates.map((names) => `- ${names.join(", ")}`).join("\n")}`);
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
const serviceLinks = `<aside class="article-service-links" aria-labelledby="related-service-title"><span class="journal-eyebrow">Related Service</span><h2 id="related-service-title">記事を読んだあとに</h2><div class="related-paths"><a href="/web-design/"><small>関連サービス</small>ホームページ制作について見る →</a><a href="/#works"><small>Related Works</small>制作実績を見る →</a></div></aside>`;

function page(post, related) {
  const url = `${baseUrl}/journal/${post.slug}/`, image = post.image ? new URL(post.image, baseUrl).href : `${baseUrl}/assets/images/new-ogp.png`;
  const modified = post.updated || post.date;
  const articleJson = { "@context": "https://schema.org", "@type": "BlogPosting", headline: post.title, datePublished: post.date, dateModified: modified, author: { "@type": "Person", name: post.author }, image: [image], mainEntityOfPage: { "@type": "WebPage", "@id": url }, publisher: { "@type": "Organization", name: "SunnySideDesign", url: baseUrl } };
  const breadcrumbJson = { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "SunnySideDesign", item: `${baseUrl}/` }, { "@type": "ListItem", position: 2, name: "Journal", item: `${baseUrl}/journal/` }, { "@type": "ListItem", position: 3, name: post.title, item: url }] };
  return `<!DOCTYPE html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(post.title)} | Sunny Side Journal | SunnySideDesign</title><meta name="description" content="${escapeHtml(post.excerpt)}"><link rel="canonical" href="${url}">${post.draft ? '<meta name="robots" content="noindex, nofollow">' : ''}<meta property="og:title" content="${escapeHtml(post.title)}"><meta property="og:description" content="${escapeHtml(post.excerpt)}"><meta property="og:type" content="article"><meta property="og:url" content="${url}"><meta property="og:image" content="${image}"><meta property="article:published_time" content="${post.date}"><meta property="article:modified_time" content="${modified}"><meta name="twitter:card" content="summary_large_image"><link rel="icon" href="/assets/images/favicon.png"><link href="https://fonts.googleapis.com/css2?family=Poppins:wght@600;700&family=Noto+Sans+JP:wght@400;500;700&family=Caveat:wght@400;700&display=swap" rel="stylesheet"><link rel="stylesheet" href="/assets/css/style.css?v=20260813"><link rel="stylesheet" href="/assets/css/journal.css?v=20260813"><script type="application/ld+json">${JSON.stringify(articleJson).replace(/</g, "\\u003c")}</script><script type="application/ld+json">${JSON.stringify(breadcrumbJson).replace(/</g, "\\u003c")}</script><script defer src="/assets/js/script.js?v=20260813"></script></head><body class="journal-page">${post.draft ? '<div class="draft-notice">下書きプレビュー：公開一覧・sitemap・RSSには表示されません</div>' : ''}<header class="site-header"><div class="container header-inner"><a href="/" class="site-logo" aria-label="SunnySideDesign トップへ"><img src="/assets/images/logo.png" alt="SunnySideDesign"></a><nav class="site-nav" aria-label="メインナビゲーション"><a href="/">HOME</a><a href="/#service">SERVICE</a><a href="/#works">WORKS</a><a href="/journal/" aria-current="page">JOURNAL</a><a href="/#about">ABOUT</a><a href="/#contact">CONTACT</a></nav><button class="menu-toggle" aria-expanded="false" aria-label="メニューを開く"><span></span><span></span></button></div></header><main><nav class="breadcrumb container" aria-label="パンくず"><ol><li><a href="/">SunnySideDesign</a></li><li><a href="/journal/">Journal</a></li><li aria-current="page">${escapeHtml(post.title)}</li></ol></nav><header class="article-header"><div class="container article-header-inner"><div class="journal-meta"><span class="journal-category">${escapeHtml(post.category)}</span><time datetime="${post.date}">公開 ${dateJa(post.date)}</time>${post.updated ? `<time datetime="${post.updated}">更新 ${dateJa(post.updated)}</time>` : ""}<span>著者 ${escapeHtml(post.author)}</span></div><h1>${escapeHtml(post.title)}</h1><p class="article-lead">${escapeHtml(post.excerpt)}</p></div>${post.image ? `<img class="article-cover" src="${escapeHtml(post.image)}" alt="${escapeHtml(post.title)}のアイキャッチ" width="1200" height="630">` : ""}</header><div class="article-layout"><article class="article-body">${markdown(post.body)}</article><div class="article-after"><div class="author-panel"><img src="/assets/images/profile-icon.png" alt="katokenのプロフィール画像" width="96" height="96" loading="lazy"><div><span class="journal-eyebrow">Author</span><h2>katoken</h2><p class="author-role">営業マン × デザイナー × AIエンジニア</p><p>SunnySideDesign代表。制作とAI活用の実践から得た気づきを発信しています。</p></div></div>${related.length ? `<section class="journal-section"><div class="journal-section-head"><div><span class="journal-eyebrow">Related</span><h2 class="journal-heading">関連記事</h2></div></div><div class="journal-grid">${related.map(card).join("")}</div></section>` : ""}<div class="article-actions"><a class="outline-btn" href="/journal/">Journalトップへ戻る →</a><a class="primary-btn" href="/#contact">制作について相談する →</a></div></div></div></main><footer class="site-footer"><div class="container footer-inner"><div class="footer-left"><a href="/"><img src="/assets/images/logo.png" alt="SunnySideDesign"></a></div><nav class="footer-nav"><a href="/">HOME</a><a href="/#service">SERVICE</a><a href="/#works">WORKS</a><a href="/journal/">JOURNAL</a><a href="/#about">ABOUT</a></nav></div><div class="copyright">© SunnySideDesign All Rights Reserved.</div></footer></body></html>`;
}

function categoryPage(category, categoryPosts) {
  const url = `${baseUrl}/journal/category/${category.slug}/`;
  const breadcrumbJson = { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "SunnySideDesign", item: `${baseUrl}/` }, { "@type": "ListItem", position: 2, name: "Journal", item: `${baseUrl}/journal/` }, { "@type": "ListItem", position: 3, name: category.name, item: url }] };
  return `<!DOCTYPE html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(category.name)}の記事 | Sunny Side Journal | SunnySideDesign</title><meta name="description" content="${escapeHtml(category.description)}"><link rel="canonical" href="${url}"><meta property="og:title" content="${escapeHtml(category.name)}の記事 | Sunny Side Journal"><meta property="og:description" content="${escapeHtml(category.description)}"><meta property="og:type" content="website"><meta property="og:url" content="${url}"><meta property="og:image" content="${baseUrl}/assets/images/new-ogp.png"><meta name="twitter:card" content="summary_large_image"><link rel="icon" href="/assets/images/favicon.png"><link href="https://fonts.googleapis.com/css2?family=Poppins:wght@600;700&family=Noto+Sans+JP:wght@400;500;700&family=Caveat:wght@400;700&display=swap" rel="stylesheet"><link rel="stylesheet" href="/assets/css/style.css?v=20260813"><link rel="stylesheet" href="/assets/css/journal.css?v=20260826"><link rel="stylesheet" href="/assets/css/pages.css?v=20260823"><script type="application/ld+json">${JSON.stringify(breadcrumbJson).replace(/</g, "\\u003c")}</script><script defer src="/assets/js/script.js?v=20260826"></script></head><body class="journal-page"><header class="site-header"><div class="container header-inner"><a href="/" class="site-logo" aria-label="SunnySideDesign トップへ"><img src="/assets/images/logo.png" alt="SunnySideDesign"></a><nav class="site-nav" aria-label="メインナビゲーション"><a href="/">HOME</a><a href="/#service">SERVICE</a><a href="/#works">WORKS</a><a href="/journal/" aria-current="page">JOURNAL</a><a href="/#about">ABOUT</a><a href="/#contact">CONTACT</a></nav><button class="menu-toggle" aria-expanded="false" aria-label="メニューを開く"><span></span><span></span></button></div></header><main><nav class="breadcrumb container" aria-label="パンくず"><ol><li><a href="/">SunnySideDesign</a></li><li><a href="/journal/">Journal</a></li><li aria-current="page">${escapeHtml(category.name)}</li></ol></nav><header class="category-header"><div class="container"><span class="journal-eyebrow">Journal Category</span><h1>${escapeHtml(category.name)}</h1><p>${escapeHtml(category.description)}</p></div></header><section class="journal-section" aria-labelledby="category-articles"><div class="container"><div class="journal-section-head"><div><span class="journal-eyebrow">Articles</span><h2 class="journal-heading" id="category-articles">${escapeHtml(category.name)}の記事</h2></div><p class="category-count">${categoryPosts.length}件</p></div><div class="journal-grid">${categoryPosts.map(card).join("")}</div><div class="category-back"><a class="outline-btn" href="/journal/#categories-title">すべてのテーマを見る →</a></div></div></section></main><footer class="site-footer"><div class="container footer-inner"><div class="footer-left"><a href="/"><img src="/assets/images/logo.png" alt="SunnySideDesign"></a></div><nav class="footer-nav"><a href="/">HOME</a><a href="/#service">SERVICE</a><a href="/#works">WORKS</a><a href="/journal/">JOURNAL</a><a href="/#about">ABOUT</a><a href="/privacy/">PRIVACY POLICY</a></nav></div><div class="copyright">© SunnySideDesign All Rights Reserved.</div></footer></body></html>`;
}

function replaceBlock(source, name, content) {
  const re = new RegExp(`<!-- ${name}_START -->[\\s\\S]*?<!-- ${name}_END -->`);
  if (!re.test(source)) throw new Error(`${name} の生成マーカーが見つかりません`);
  return source.replace(re, `<!-- ${name}_START -->${content}<!-- ${name}_END -->`);
}

const files = (await fs.readdir(sourceDir)).filter((x) => x.endsWith(".md"));
const posts = await Promise.all(files.map(async (file) => parsePost(file, await fs.readFile(path.join(sourceDir, file), "utf8"))));
const slugs = new Set(); for (const post of posts) { if (slugs.has(post.slug)) throw new Error(`slugが重複しています: ${post.slug}`); slugs.add(post.slug); }
await validateImages(posts);
posts.sort((a, b) => b.date.localeCompare(a.date));
const published = posts.filter((post) => !post.draft);
if (!published.length) throw new Error("公開記事が0件のため、Journalを生成できません");
if (selectedSlug && !slugs.has(selectedSlug)) throw new Error(`記事が見つかりません: ${selectedSlug}`);
const articleTargets = selectedSlug ? posts.filter((post) => post.slug === selectedSlug) : posts;
for (const post of articleTargets) {
  const related = [
    ...published.filter((x) => x.slug !== post.slug && x.category === post.category),
    ...published.filter((x) => x.slug !== post.slug && x.category !== post.category),
  ].slice(0, 3);
  const html = page(post, related)
    .replace('<div class="article-after">', `<div class="article-after">${serviceLinks}`)
    .replace('<link rel="stylesheet" href="/assets/css/journal.css?v=20260813">', '<link rel="stylesheet" href="/assets/css/journal.css?v=20260813"><link rel="stylesheet" href="/assets/css/pages.css?v=20260823">')
    .replace("journal.css?v=20260813", "journal.css?v=20260823")
    .replace('</head>', '<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-2801111628934180" crossorigin="anonymous"></script></head>')
    .replace('<a href="/#about">ABOUT</a></nav>', '<a href="/#about">ABOUT</a><a href="/privacy/">PRIVACY POLICY</a></nav>');
  await writeIfChanged(`journal/${post.slug}/index.html`, prettyHtml(html));
}

const indexedCategories = categoryDefinitions
  .map((category) => ({ ...category, posts: published.filter((post) => post.category === category.name) }))
  .filter((category) => category.posts.length > 0);
const selectedPost = selectedSlug ? posts.find((post) => post.slug === selectedSlug) : null;
for (const category of indexedCategories.filter((category) => !selectedPost || category.name === selectedPost.category)) {
  await writeIfChanged(`journal/category/${category.slug}/index.html`, prettyHtml(categoryPage(category, category.posts)));
}

let journalIndex = await fs.readFile(path.join(root, "journal/index.html"), "utf8");
const featured = featuredSlugs.map((slug) => published.find((post) => post.slug === slug)).filter(Boolean);
journalIndex = replaceBlock(journalIndex, "JOURNAL_FEATURED", `<div class="journal-grid">${featured.map(card).join("")}</div>`);
journalIndex = replaceBlock(journalIndex, "JOURNAL_LATEST", `<div class="journal-grid">${published.map(card).join("")}</div>`);
await writeIfChanged("journal/index.html", journalIndex);

let home = await fs.readFile(path.join(root, "index.html"), "utf8");
home = replaceBlock(home, "JOURNAL_HOME", `<div class="journal-grid">${published.slice(0, 3).map(card).join("")}</div>`);
await writeIfChanged("index.html", home);

const latestDate = (items) => items.reduce((latest, post) => (post.updated || post.date) > latest ? (post.updated || post.date) : latest, items[0].date);
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${baseUrl}/</loc></url>\n  <url><loc>${baseUrl}/journal/</loc><lastmod>${latestDate(published)}</lastmod></url>\n${indexedCategories.map((category) => `  <url><loc>${baseUrl}/journal/category/${category.slug}/</loc><lastmod>${latestDate(category.posts)}</lastmod></url>`).join("\n")}\n${published.map((p) => `  <url><loc>${baseUrl}/journal/${p.slug}/</loc><lastmod>${p.updated || p.date}</lastmod></url>`).join("\n")}\n</urlset>\n`;
const sitemapWithPrivacy = sitemap.replace(
  `  <url><loc>${baseUrl}/</loc></url>\n`,
  `  <url><loc>${baseUrl}/</loc></url>\n  <url><loc>${baseUrl}/web-design/</loc></url>\n  <url><loc>${baseUrl}/works/welfare-facility-website/</loc></url>\n  <url><loc>${baseUrl}/privacy/</loc></url>\n`,
);
await writeIfChanged("sitemap.xml", sitemapWithPrivacy);
const rss = `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel><title>Sunny Side Journal</title><link>${baseUrl}/journal/</link><description>AIとデザイン、暮らしの実践ノート。</description><language>ja</language>${published.map((p) => `<item><title>${escapeXml(p.title)}</title><link>${baseUrl}/journal/${p.slug}/</link><guid>${baseUrl}/journal/${p.slug}/</guid><pubDate>${new Date(`${p.date}T00:00:00+09:00`).toUTCString()}</pubDate><description>${escapeXml(p.excerpt)}</description></item>`).join("")}</channel></rss>\n`;
await writeIfChanged("journal/rss.xml", rss);
if (selectedSlug) {
  const categorySlug = categoryDefinitions.find((category) => category.name === selectedPost.category).slug;
  const expected = new Set([
    `journal/${selectedSlug}/index.html`,
    `journal/category/${categorySlug}/index.html`,
    "journal/index.html", "index.html", "journal/rss.xml", "sitemap.xml",
  ]);
  const unexpected = (check ? mismatchedFiles : changedFiles).filter((file) => !expected.has(file));
  if (unexpected.length) {
    console.error(`Unexpected files changed for --slug ${selectedSlug}:\n${unexpected.map((file) => `- ${file}`).join("\n")}`);
    process.exitCode = 1;
  }
}
if (check && mismatchedFiles.length) {
  console.error("Generated files are out of date:");
  for (const file of mismatchedFiles) console.error(`- ${file}`);
  process.exitCode = 1;
} else {
  console.log(`Journal ${check ? "check" : "build"} complete: ${published.length} published, ${posts.length - published.length} draft`);
}
const reported = check ? mismatchedFiles : changedFiles;
console.log(`${check ? "Mismatched" : "Changed"} files: ${reported.length ? "" : "none"}`);
for (const file of reported) console.log(`- ${file}`);
