# SunnySideDesign Repository Instructions

## Project Memory

作業開始前に以下を確認する。

- /memory/10_Projects/SunnySideDesign.md
- /memory/50_SOP/Memory-Policy.md
- /memory/50_SOP/Git-Workflow.md

Journal関連の作業では追加で確認する。

- /memory/50_SOP/Journal-SOP.md

必要に応じて以下も確認する。

- /memory/30_Decisions/

## Repository Safety

作業開始時に必ず確認する。

1. git status
2. 現在のbranch
3. remoteとの状態
4. 既存の未コミット変更

ユーザーの既存変更を削除・上書きしない。

mainへ直接pushしない。

作業ごとに専用branchを使用する。

## Scope

依頼された作業に必要なファイルだけ変更する。

無関係な以下の作業を勝手に行わない。

- リファクタリング
- デザイン変更
- dependency更新
- 設定変更
- ファイル整理

## Journal

Journal関連では `/memory/50_SOP/Journal-SOP.md` を優先する。

特に以下を守る。

- 既存記事の構造を確認する
- 既存schemaを優先する
- slug重複を確認する
- 同一画像を別名で複製しない
- buildによる大量の無関係差分に注意する

## Validation

変更後は、

1. git diff
2. build
3. lint/test（存在する場合）
4. git status

を確認する。

build失敗時は原則commit・push・PR作成まで進めない。

## Human Approval

以下は人間の承認なしに実行しない。

- PR merge
- mainへの直接反映
- 本番公開
- 大規模構造変更
- データ削除