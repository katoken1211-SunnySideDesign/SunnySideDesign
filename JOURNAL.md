# Sunny Side Journal 記事追加ガイド

## 作業開始前の安全確認

次を実行し、branch・ahead/behind・変更・conflict・stashを確認します。

```bash
git status --short --branch
git fetch origin
git rev-list --left-right --count HEAD...origin/main
git stash list
```

cleanなら必要に応じて `git pull --ff-only origin main` を使います。dirtyなら元の作業を触らず、`origin/main` から隔離worktreeを作ります。

```bash
git worktree add -b journal/<slug> ../SunnySideDesign-journal-<slug> origin/main
cd ../SunnySideDesign-journal-<slug>
```

dirty worktreeでの `git pull --rebase --autostash` は行いません。stashを使った場合は前後に `git stash list` と `git status` を確認し、確認なしに削除しません。

## 記事と画像を追加する

`content/journal/<slug>.md` を作り、画像は `assets/images/journal/` に1ファイルだけ置きます。アイキャッチと本文が同じ画像なら同じパスを参照し、別名コピーは作りません。

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

カテゴリは `AI活用`、`デザイン`、`Web制作`、`働き方・思考`、`暮らし` のいずれかです。公開時は `draft: false` にします。日付は実在する `YYYY-MM-DD`、`updated` は `date` 以降、slugは英小文字・数字・ハイフンを使います。

## 限定ビルドと検証

```bash
npm run journal:article -- --slug <slug>
npm run journal:article -- --slug <slug>
npm run journal:check
git diff --check
git diff --name-only --diff-filter=U
```

2回目が `Changed files: none` になることを確認します。`--slug` は対象記事、対象カテゴリ、Journal一覧、トップページのJournalブロック、RSS、sitemapだけを更新します。全記事を意図的に再生成するときだけ `npm run journal:build` を使います。

## ステージと公開

`git add .` は使わず、今回のファイルだけを明示します。コミット前に必ず差分を確認します。

```bash
git add content/journal/<slug>.md assets/images/journal/<image> journal/<slug>/index.html journal/category/<category>/index.html journal/index.html index.html journal/rss.xml sitemap.xml
git diff --cached --stat
git diff --cached
git status --short --branch
git stash list
```

他の変更が混ざっていたらコミットしません。push前に再度 `git fetch origin` とahead/behindを確認し、必要ならcleanな記事worktreeで `git merge --ff-only origin/main` など安全な統合方針を判断します。force pushは行いません。
