# Sunny Side Journal 記事追加ガイド

1. `content/journal/` に `.md` ファイルを追加します。
2. 下記のFront Matterと本文を書きます。
3. リポジトリ直下で `node scripts/build-journal.mjs` を実行します。
4. 生成されたHTML、`sitemap.xml`、`journal/rss.xml` を確認してコミットします。

```yaml
---
title: "記事タイトル"
date: "2026-08-13"
updated: "2026-08-13"
category: "AI活用"
excerpt: "記事概要"
author: "katoken"
image: "/assets/images/journal/example.webp"
featured: false
draft: true
slug: "example-slug"
---
```

カテゴリは `AI活用`、`デザイン`、`Web制作`、`働き方・思考`、`暮らし` のいずれかです。公開するときは `draft: false` にします。画像は `assets/images/journal/` に配置し、WebPまたはAVIFを推奨します。
