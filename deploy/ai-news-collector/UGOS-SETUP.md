# UGOS：独立した AI ニュース収集コンテナ

専用の `ai-news-collector` プロジェクト／コンテナで、**毎週月曜・水曜17:30（Asia/Tokyo）** に収集します。月→水は2日、水→月は5日であり、48時間ごとの実行ではありません。

実装時点ではコンテナを作成・起動・再起動していません。以下の起動手順は、後日管理者が起動すると判断した際に実施するものです。

## 構成

- Python標準ライブラリのスケジューラを主処理にします。cronは不要です。
- サービスは1つだけです。既存の `codex-agent` の設定、Project、稼働状態を操作しません。
- イメージに入れるのはcollector・scheduler・起動時検証用のPythonモジュールだけです。サイト、Git、Memory、下書きは含みません。
- 既存inboxの `items`・`runs`・`scheduler` だけを、それぞれ `/data/items`・`/data/runs`・`/data/scheduler` へマウントします。inboxの親と `drafts` はコンテナに渡しません。同じ3つの保存先を使えば、再作成後も記事・状態・ログを引き継げます。
- UID・GID・補助グループに0が含まれる実行を、起動時に拒否します。設定したUID/GIDと実行時のIDが違う場合も収集しません。
- Dockerソケット、ホストPID名前空間、ポート公開、特権モードは使いません。ルートファイルシステムは読み取り専用です。
- CPU上限0.5、メモリ上限256 MB。Dockerの標準出力ログは5 MB × 3ファイルです。永続ログは自動削除しません。

`compose.yaml` はJSON形式で記述した有効なYAMLです。構造の検査に追加のPython依存は不要です。UGOSの貼り付け画面で受け付けない場合は、後述の `docker compose config` が出力するYAMLを使います。

## 予定・失敗・再起動

| 状況 | 動作 |
| --- | --- |
| 状態ファイルのない初回起動 | 次の月／水17:30を登録し待機。初回に過去の予定を実行しません |
| 通常運転 | 最大30秒間隔で確認し、予定時刻以降に実行。秒単位の起動保証はありません |
| 正常終了後の再起動 | 保存した次回予定を読み込み、成功済みの回を繰り返しません |
| 予定時刻に停止していた場合 | 保存された期限切れの予定を起動後に実行。複数回の未実行は最新の予定1回にまとめます |
| 一部フィードの失敗・非ゼロ終了・タイムアウト | 成功扱いにせず15分後に再試行。初回を含め最大3回で打ち切り、次の月／水へ進みます |
| 実行中の強制終了 | 同じ予定なら残りの試行回数で再試行。新しい予定も期限切れなら最新の1回にまとめ、試行回数を0に戻します。古い3回目の中断が新しい予定を消費することはありません |
| SIGTERM／通常停止 | 新規実行を止め、子プロセスへ終了要求。最大5秒後に強制終了し状態を保存します |
| 状態破損・書き込み失敗 | 自動初期化せず異常終了。書ける場合は永続ログ、それ以外はDockerログに記録します |

収集全体の上限は180秒です。終了猶予を含め約185秒になる場合があります。タイムアウトには単調増加時計を使い、予定はホスト設定に依存せず `Asia/Tokyo` で計算します。状態とログはUTCです。17:30 JSTは08:30 UTCです。

ファイルロックはスケジューラ稼働中に保持し、子プロセスも継承します。同じデータ領域で2つ起動すると後続は終了コード75で終了します。ロックファイルの存在だけでは稼働中を意味しません。運転中は削除しないでください。従来collectorの手動実行はこのロックに参加しないため、運転中は併用しません。

電源断などで「収集成功後、状態保存前」に停止すると、再実行される可能性があります。厳密な一度だけの実行は保証せず、collectorのURL重複排除と上書きしない保存で既存記事を保護します。実NASの再起動試験は未実施です。

取得範囲は直近7日です。長期停止中の記事やRSSから消えた記事の完全な取り戻しは保証しません。NASの時刻同期も確認してください。

## 永続データ

```text
ai-news-inbox/
  items/                  # 従来の記事
  runs/                   # 従来の取得結果
  drafts/                 # コンテナにはマウントしない。読み書き不可
  scheduler/
    state.json            # 次回予定、試行回数、実行中、最後の成功日時
    collector.lock        # 排他制御用。消さない
    logs/
      events.jsonl        # 起動、成功、失敗、復旧、打ち切り等
      <UTC日時>-<ID>.log  # 試行ごとの標準出力・標準エラー
```

状態は一時ファイルへの書き込み・fsync・置換・ディレクトリfsyncで保存します。NASのバックアップの代わりにはなりません。永続ログの蓄積量は定期的に確認してください。

## NAS側で確認する値

1. **inboxのホスト絶対パス**：観測できたマウント元はBtrfs内の `/Development` ですが、NAS上の絶対パスとは限りません。UGOSの既存マウント情報、またはNAS上の次の読み取り専用コマンドで確認します。

   ```sh
   docker inspect codex-agent --format '{{json .Mounts}}'
   ```

   `/workspace` の `Source` に相当するディレクトリの下の `ai-news-inbox` を指定します。コンテナ内の `/workspace/ai-news-inbox` をNAS側のパスと決めつけないでください。

2. **専用NASユーザーの数値UID/GID**：管理画面または `id ユーザー名` で確認します。UID・GIDとも0は禁止です。1〜2147483647の数値を使い、1000などと推測しません。
3. **アクセス権**：そのユーザーが `items`・`runs` 内の既存ファイルを読み、3つの保存先にファイルを作成でき、既存の `scheduler` 内ファイルを読み書きできることが必要です。既存所有者やACLは自動変更しません。実装環境ではモード000と表示されたため、下記の実UID/GIDによる事前確認を行います。
4. **自動起動とストレージ**：NAS起動後、Dockerアプリとinboxのマウントが利用可能になることを確認します。

既存inboxをバックアップ対象にしてください。3つの子ディレクトリはすべて存在する必要があります。初回のみ `scheduler` がなければ、管理者がNAS上の正しい場所に作成し、選んだユーザーへ権限を設定してください。Composeと事前確認は、欠けたディレクトリを自動作成しません。

## 設定確認だけを行う（コンテナは起動しない）

NAS上のリポジトリで `deploy/ai-news-collector` に移動します。後日準備する際に `.env.example` を `.env` としてコピーし、ホストパス・UID・GIDを実値に置き換えます。`.env` はGit対象外です。値は固定値を使い、変数展開や行末コメントは使いません。パス全体を引用符で囲めますが、パス自体に `$`・`#`・バックスラッシュ・引用符を含む形式は事前確認で拒否します。

```sh
docker compose --env-file .env -f compose.yaml -p ai-news-collector config --quiet
docker compose --env-file .env -f compose.yaml -p ai-news-collector config --services
```

サービス一覧が `ai-news-collector` だけであることを確認します。この2コマンドは起動・停止・再作成を行いません。`pull_policy`、`bind.create_host_path`、`init`、各リソース制限を受け付けるComposeが必要です。UGOSの実機で設定検証が失敗する場合は展開せず、非対応の項目を確認してください。

次に、**NASホスト上のPython 3.11以降**で事前確認します。開発コンテナ内からでは、ホストのパスとACLを検証できません。PythonがNASにない場合、ここではインストールせず未検証として扱います。

```sh
python3 -B ../../scripts/preflight-ai-news.py --env-file .env
```

このコマンドは `docker inspect codex-agent` で `/workspace` の既存bind mountの `Source` を読み、`.env` のinboxパスがその直下の `ai-news-inbox` か照合します。`codex-agent` の設定や稼働状態は変えません。NAS管理画面でSourceを確認済みの場合は、明示してDocker参照を省略できます。

```sh
python3 -B ../../scripts/preflight-ai-news.py --env-file .env --workspace-source /VERIFIED_NAS_WORKSPACE_SOURCE
```

事前確認は次を検査し、どれか失敗すれば終了コード1になります。

- 絶対パス・既存3ディレクトリ・シンボリックリンク不使用。マウント対象内のハードリンクや特殊ファイルも拒否します。下書きへの別名リンクを持ち込めません。
- 非root UID/GID。シェル環境変数が `.env` を別の値で上書きする場合も拒否します。
- 実際のサービスUID/GIDで、ディレクトリの読み書き・探索、既存ファイルへの必要なアクセス、作成・ハードリンク・置換・fsync・ファイルロックが可能か。

NAS管理者のrootで事前確認を実行した場合も、ファイル操作の子プロセスは指定した非root UID/GIDへ切り替え、補助グループを空にします。非rootで実行する場合はUID/GIDが一致し、別の補助グループがないことが条件です。追加グループの権限による誤った合格を避けます。

権限検査では3つの保存先に一時的な `.ai-news-preflight-*` ディレクトリを作り、自分が作った検査ファイルだけを削除します。既存データ、所有者、ACLは変更せず、`drafts` の中は読みません。対象collectorを停止した状態で行ってください。強制終了で検査用ディレクトリが残った場合は、内容を管理者が確認してください。

収集コンテナの起動時にも、実UID/GID、読み取り専用の親、3つの独立した書き込みマウント、別名リンク、権限を検証し、失敗時は収集前に終了します。`/data` 全体や `drafts` をマウントする旧構成も拒否します。ホストの実パス照合は上記のNAS側事前確認で行います。

Dockerのない開発環境ではComposeネイティブ検証と実NASの事前確認は未実施です。

リポジトリ直下からのローカル確認：

```sh
python3 -B scripts/schedule-ai-news.py --check-config
python3 -B -m unittest discover -s tests -p 'test_*ai_news.py' -v
```

`--check-config` は予定の表示だけを行い、ファイルを書きません。UID/GID・マウント・ACLの合格を意味しません。テストは一時ディレクトリと短命なテスト用Pythonプロセスだけを使い、RSS取得、実inboxへの書き込み、Docker操作は行いません。

## 後日、管理者が起動する場合

### NAS上のCompose CLI

同じディレクトリで、プロジェクト名とサービスを限定します。

```sh
docker compose --env-file .env -f compose.yaml -p ai-news-collector build ai-news-collector
docker compose --env-file .env -f compose.yaml -p ai-news-collector up -d --no-deps ai-news-collector
docker compose --env-file .env -f compose.yaml -p ai-news-collector logs --tail 100 ai-news-collector
```

先に `build` でローカルの `ai-news-collector:local` を作成してください。`pull_policy: never` により、起動時に同名のレジストリイメージを取得しません。ローカルイメージがなければ自動pullに頼らず、明示したビルド手順へ戻ります。ビルド時は必要に応じて公式Pythonベースイメージを取得します。追加のPythonパッケージはインストールしません。実装時点ではDockerイメージのビルド・コンテナによる検証は未実施です。[Docker公式pull policy](https://docs.docker.com/reference/compose-file/services/#pull_policy)

### UGOS DockerのProject画面

Project → Createで別プロジェクト `ai-news-collector` を作成し、Compose設定をインポートします。**Deployは実際に起動する操作**です。画面の詳細はバージョンにより異なります。[UGREEN公式Projectガイド](https://support.ugnas.com/detail/article/en-US/411)

UGOSが設定を別フォルダへコピーすると相対ビルドパスが変わります。NAS上の元ディレクトリで先に上記の `build` を実行し、次の出力をインポートしてください。

```sh
docker compose --env-file .env -f compose.yaml -p ai-news-collector config
```

出力の `build.context` がNAS上の正しいリポジトリ、3つの `volumes.source` が既存inbox内の `items`・`runs`・`scheduler` を指すことを確認します。親inboxや `drafts` のマウントを追加せず、非rootの `user` と `pull_policy: never` も保持してください。実値が解決されたYAMLなのでUGOS側で `.env` を読めるかには依存しません。CLIで既に `up` した場合は、GUIで同名コンテナを重ねて作成しません。既存の `codex-agent` のProjectへ追加しないでください。

## 起動後の確認・停止

- ログの `scheduler_ready` と `state.json` の `next_due_at` を確認します。
- 月／水17:30以降の `finished` が `status: success` になり、`last_success_at` と次回予定が更新されることを確認します。新規0件でも正常取得なら成功です。
- エラーは `events.jsonl` の `log` が示す試行ログで調べます。権限などで永続ログを作れなければDockerログを確認します。
- 壊れた状態は保管して調査し、正常なバックアップからの復元を優先します。状態を削除すると未実行予定・試行回数を失います。
- 後日の再起動試験は専用コンテナだけを対象にし、成功回の重複がないこと、NAS再起動後も同じ状態とマウントに戻ることを確認します。

停止も対象を限定します。

```sh
docker compose --env-file .env -f compose.yaml -p ai-news-collector stop ai-news-collector
```

`restart: unless-stopped` は通常のDocker再起動後の復帰に使いますが、手動停止したコンテナは停止したままです。再開は同じ専用プロジェクトの `up` で行います。[Docker公式再起動ポリシー](https://docs.docker.com/engine/containers/start-containers-automatically/)

この構成は収集だけを行い、下書き生成、公開、Git操作、有料API、Ollamaは実行しません。
