# AGENTS | cost-management-mcp

> **適用範囲 / Scope**
>
> - このファイルはリポジトリ直下 (`/`) に配置され、リポジトリ全体へ適用されます。
> - 将来的にパッケージ配下へ `AGENTS.md` が追加された場合は、"近接優先" ルールに従い、より深い階層の指示を優先してください (Closest file wins)。
> - 現在このリポジトリは単一パッケージ構成であり、追加のローカル `AGENTS.md` は存在しません。

---

## 1. Overview | 概要

### 1.1 Mission Statement | 目的

- このリポジトリは **Model Context Protocol (MCP)** サーバーを実装し、AWS / OpenAI / Anthropic など複数クラウド・API のコストを統合的に分析・可視化します。
- TypeScript (Node.js) ベースで、MCP クライアント (例: Claude Desktop) からの自然言語クエリに応答するツール群を提供します。
- 既存のCI/CD (GitHub Actions) と連携し、品質 (Lint/Typecheck/Test) とセキュリティ (Audit/Secret scan) を自動化しています。

### 1.2 Architecture Snapshot | アーキテクチャ概観

- ランタイム: Node.js >= 18 (CIでは 18.x / 20.x をサポート)。
- 言語: TypeScript 5.x。CommonJS 出力 (`type: "commonjs"`)。
- フレームワーク: MCP SDK (`@modelcontextprotocol/sdk`) を用いたツール定義。
- テスト: Jest (ts-jest) によるユニット/統合テスト。カバレッジ収集は Codecov へ送信。
- Lint/Format: ESLint + Prettier (lint-staged と Husky でプリコミット適用)。
- キャッシュ層: `node-cache` (in-memory)、オプションで Redis (`REDIS_URL`) を使用可能。
- Secrets 管理: `.env` or MCP config (例: `.mcp.json`) を通じて環境変数で渡す。リポジトリには秘匿情報を含めない。

### 1.3 Directory Map | 主要ディレクトリ

- `/src` : ソースコード (MCP ツール、サービス、キャッシュ実装)。
- `/tests` : Jest テストケース。`__snapshots__` 等がある場合はここに格納。
- `/node_modules` : インストール済み依存。**原則編集禁止。**
- `/dist` : `npm run build` で生成される出力。Git管理外。
- `/configs` ディレクトリは存在しませんが、`tsconfig.json` / `jest.config.js` / `eslint.config.js` / `.prettierrc` がリポジトリ直下にあります。
- `/.github/workflows` : GitHub Actions 定義 (`ci.yml`, `release.yml`, `security.yml` 等)。
- `.env.example` : 必須環境変数のサンプル。**実値は追加しないでください。**
- `mcp-config-example.json`, `.mcp.json.example` : MCP クライアント用設定例。

### 1.4 Key Entry Points | 重要エントリポイント

- `src/index.ts` : MCP サーバーの起動ポイント。`npm run dev` / `npm run start` で参照。
- `src/tools/*` : 個別ツール定義 (`cost_get`, `provider_list`, etc.)。
- `src/services/*` : 各クラウド/ベンダーとの通信ロジック。
- `src/utils/*` : 共通ユーティリティ (キャッシュ、フォーマッタなど)。
- `tests/**/*.test.ts` : Jest テスト。

### 1.5 Documentation Cross-Links | 追加資料

- `README.md` : 機能概要、利用例、バッジ。
- `CONTRIBUTING.md` : 貢献ガイドライン (コミット規約はConventional Commits推奨)。
- `openai-analysis-report.md`, `billing-apis-research.md` : ドメイン調査メモ。
- `TEST_RESULTS.md` : 過去テスト実行レポート (参考程度)。

---

## 2. Setup | 開発環境構築

### 2.1 Prerequisites | 前提条件

- **Node.js**: 18.x 以上 (CI互換のため 20.x も検証済み)。nvm 利用時: `nvm install 20 && nvm use 20` を推奨。
- **npm**: Node.js 同梱版。`npm ci` を利用するため 8.x+。
- **Git**: 2.40 以上推奨。
- **Optional**: Redis を用いる場合はローカルに `redis-server` を準備。

### 2.2 First-time Setup | 初回セットアップ手順

1. リポジトリをクローン: `git clone <repo-url>`。
2. ブランチを作成: `git checkout -b feature/<topic>` (詳細は §7 を参照)。
3. 依存インストール: `npm ci`。
4. 環境変数を設定:
   - `.env.example` をコピーし `.env` を作成: `cp .env.example .env`。
   - AWS/OpenAI/Anthropic のAPIキーを必要に応じて設定。**コミットしないこと。**
   - `CACHE_TYPE=memory` がデフォルト。Redis を使う場合は `CACHE_TYPE=redis` と `REDIS_URL` を設定。
5. MCP クライアントを使う場合は `mcp-config-example.json` を参照し、`~/.mcp/<client>/config.json` 等に設定。

### 2.3 Development Workflow | 開発フロー

- ウォッチ起動: `npm run dev` (tsx + hot reload)。
- 実行ビルドで検証: `npm run start` (事前に `npm run build` が必要)。
- テスト駆動: `npm run test -- --watch`。
- プリコミット: Husky が `lint-staged` を用いて `eslint --fix` と `prettier --write` を適用。

### 2.4 Secrets Handling | 秘密情報の扱い

- APIキー・シークレットは `.env` または環境変数で渡す。
- `.env`, `.mcp.json` は `.gitignore` 済み。**誤って追跡しないよう `git status` を都度確認。**
- 共有が必要な場合はセキュアなシークレットマネージャを使用し、チャットログ等に貼らない。

### 2.5 Tooling Notes | 補足

- IDE では TypeScript プロジェクト設定 (`tsconfig.json`) を読み込んでください。
- ESLint 設定は `eslint.config.js` の Flat Config 形式。VSCode 拡張の最新バージョンを推奨。
- Prettier 設定は `.prettierrc` (JSON) に記載。可能なら EditorConfig も同期。
- Jest は `jest.config.js` で ts-jest を利用。テスト対象ファイルは `*.test.ts`。

---

## 3. Build / Lint / Typecheck / Test / E2E | コマンド集

> すべて **リポジトリ直下で実行**。CI 定義 (`.github/workflows/ci.yml`) と整合することを確認しています。

| Category                | Command                              | 説明 / Notes                                                  |
| ----------------------- | ------------------------------------ | ------------------------------------------------------------- |
| Install (clean)         | `npm ci`                             | package-lock に従ってクリーンインストール。CIと同一。         |
| Install (dev追加時)     | `npm install <pkg> --save-dev`       | 追加前に要承認 (§5)。コミット前に `npm ci` で再現性確認。     |
| Build                   | `npm run build`                      | TypeScript を `dist/` にコンパイル。成果物は gitignore 済み。 |
| Build (watch)           | `npm run dev`                        | `tsx watch` によりホットリロード。ローカル開発向け。          |
| Start (prod)            | `npm run start`                      | `dist/index.js` を実行。`npm run build` 後に使用。            |
| Lint                    | `npm run lint`                       | `eslint src/**/*.ts`。CIのフォーマットチェックと同一。        |
| Lint (auto-fix)         | `npm run lint:fix`                   | 可能な限り自動修正。実行後に差分確認。                        |
| Format only             | `npx prettier "src/**/*.ts" --check` | 手動確認したい場合に使用。                                    |
| Typecheck               | `npm run typecheck`                  | `tsc --noEmit`。CIで必須。                                    |
| Test (unit/integration) | `npm test`                           | Jest 通常実行。                                               |
| Test (watch)            | `npm run test -- --watch`            | ファイル監視。                                                |
| Test (coverage)         | `npm test -- --coverage`             | ローカルでカバレッジ確認。CIでは `--ci` 付き。                |
| Test (ci parity)        | `npm test -- --coverage --ci`        | CI の `Run tests` ステップと同条件。                          |
| Smoke (tool ping)       | `node dist/index.js --help`          | デバッグ用。引数は `src/index.ts` の実装に合わせて変更。      |
| Audit                   | `npm audit --production`             | `security.yml` が実行。ローカルでも再現可。                   |
| Husky                   | `npm run prepare`                    | Husky hook 初期化。通常 `npm ci` 後に自動実行。               |
| Clean                   | `npm run clean`                      | `dist` と `coverage` を削除。                                 |
| E2E                     | _現時点で公式 E2E スイートは未定義_  | 将来 Playwright/Cypress 等を導入する場合はここに追記。        |

#### 3.1 Command Sequencing Examples | 実行例

1. `npm ci && npm run lint && npm run typecheck && npm test -- --coverage --ci` — PR 前のフルチェック。
2. `npm run dev` — MCP サーバーをホットリロードで起動し、Claude Desktop から接続。
3. `npm run build && npm run start` — 本番同等の挙動確認。

---

## 4. Runbook | よくある問題と対処法

### 4.1 Node バージョン不一致

- **症状**: `npm ci` 時に `Expected version >=18` などの警告/失敗。
- **対応**: `.nvmrc` は未同梱のため、`nvm use 20` などで CI 対応バージョンに切替。`node -v` で確認。

### 4.2 TypeScript ビルド失敗 (`Cannot find module` 等)

- **原因**: `npm ci` 未実行、または `dist/` を掃除していない。
- **対処**: `npm ci` を再実行し依存を整える。必要に応じて `npm run clean && npm run build`。

### 4.3 Jest 実行時のハング (`A worker process has failed`)

- **原因**: 環境変数不足 (APIキー等) または Redis 接続失敗。
- **対処**: `.env` を見直し、テストでは可能な限りモックを使用。不要な外部接続はモック化されているか確認。

### 4.4 Lint 失敗

- **原因**: ESLint ルール違反。
- **対処**: `npm run lint:fix` で修正し、残差分は手動対応。Flat Config のため ESLint プラグインの互換性に注意。

### 4.5 Codecov 失敗

- **原因**: CI で `coverage/lcov.info` が生成されない、または閾値未達。
- **対処**: ローカルで `npm test -- --coverage --ci` を実行し、`coverage/` の出力を確認。必要に応じテスト追加。

### 4.6 Husky Hook が動かない

- **原因**: `git config core.hooksPath` が変更されている、または `npm run prepare` 未実行。
- **対処**: `npm run prepare` を手動実行。`chmod +x .husky/*` を確認。

### 4.7 Redis 接続エラー

- **原因**: `CACHE_TYPE=redis` で Redis サーバー未起動。
- **対処**: Redis を起動 (`redis-server`) するか、`CACHE_TYPE=memory` に戻す。

### 4.8 MCP クライアントが接続失敗

- **原因**: `MCP_SERVER_PORT` のポート衝突やファイアウォール設定。
- **対処**: 別ポートを設定 (例: `MCP_SERVER_PORT=3333`) し、クライアント設定を同期。

### 4.9 npm audit の高リスク検出

- **対処**: まず `npm audit --production` で詳細を確認。依存更新は §5 の許可プロセスに従う。

### 4.10 Windows 環境での `rm` コマンド失敗

- **原因**: `npm run clean` が `rm -rf` を使用。
- **対処**: Git Bash など POSIX シェルを利用するか、PowerShell 用の同等コマンド (`Remove-Item -Recurse -Force dist,coverage`) を使用。

---

## 5. Safety & Permissions | 安全性と権限

### 5.1 許可済み (要承認不要)

- ファイル閲覧、調査、ログ取得。
- 単一ファイル単位のフォーマット・Lint・型チェック実行。
- 単体テスト (Jest) の実行。
- ドキュメントの追加・修正 (`README`, `AGENTS.md` 等)。
- 既存スクリプト (`npm run lint` 等) の実行、レポート取得。
- Pull Request 作成、ドラフト更新。

### 5.2 要承認

- 依存 (`package.json`) の追加・更新・削除。
- 大規模なリファクタリング (複数ファイルの一括移動/リネーム)。
- データベース/外部サービスへの破壊的操作 (例: 本番 Redis フラッシュ)。
- 全量 E2E テストの実行 (導入後)。
- リリースフローや CI 設定 (`.github/workflows`) の変更。

### 5.3 明示禁止

- 秘密情報 (APIキー等) のハードコード、ログ出力。
- 外部へのデータ送信 (許可された CI/CD 以外)。
- 目的不明な依存追加やロックファイルの恣意的変更。
- セキュリティポリシー違反となる操作 (例: Git 履歴からの秘匿情報削除を怠る行為)。

---

## 6. Do / Don't | 推奨と非推奨

### 6.1 Do (推奨)

- 小さな差分でPRを分割し、レビュー容易性を確保。
- 既存スクリプトとCI設定に合致したコマンドを利用。
- コードとドキュメント間で双方向参照を維持。
- TypeScriptの型安全性を活かし、`zod` で入力検証を追加する際はテストを同時に更新。
- キャッシュ層 (`node-cache` / Redis) を触る場合はフォールバック戦略をテストでカバー。
- ログレベル (`LOG_LEVEL`) の変更は `.env` で行い、コード内ハードコードは避ける。

### 6.2 Don't (非推奨)

- 巨大な God Object/Component を新規作成する。サービス層を小さく分割。
- 新機能で既存テストを無効化したまま放置する。
- `npm install` を `npm ci` の代替として常用する (再現性低下)。
- 未使用の依存やコードパスを残す。削除時は影響範囲をテストで確認。
- CI パイプラインに無断で追加ジョブ/削除を行う。
- Secrets を `.env.example` へ書き込む。例示はプレースホルダに留める。

---

## 7. PR / CI Rules | プルリク / CI 運用

### 7.1 Branch Strategy | ブランチ運用

- メインブランチ: `main`。保護対象。
- 開発用ブランチ: `develop` が存在 (CI トリガ対象)。
- トピックブランチ命名例: `feature/<summary>`, `fix/<issue-id>`, `chore/<task>`。
- 本タスクのようなメンテナンスは `chore/<topic>` を推奨。

### 7.2 Commit Convention | コミット規約

- **Conventional Commits** に従う: `feat:`, `fix:`, `chore:`, `docs:` など。
- 例: `docs: update AGENTS instructions`。
- 1コミットにつき1トピック。必要なら `git rebase -i` で整形。

### 7.3 Pull Request Checklist | PR チェック項目

- CIバッジ (GitHub Actions) が全てグリーンであること。
- Lint / Typecheck / Test コマンド結果をPR説明欄に記載。
- 変更範囲とテスト範囲を明確化 (ファイル単位で記載)。
- レビュワーが確認しやすいようスクリーンショットやログを添付 (該当時)。
- 破壊的変更 (API契約変更等) は BREAKING CHANGE をコミットメッセージ本文に記録。

### 7.4 Required Status Checks | 必須ステータス

- `CI / test (18.x)`
- `CI / test (20.x)`
- `CI / build`
- `Security Scan` (参考。失敗時は調査必須)
- Dependabot PR では `close-stale-dependency-prs` が自動管理。

### 7.5 Release Workflow | リリース

- `release.yml` によりタグ付け時に自動リリースが走る。詳細は workflow ファイル参照。
- リリース前に `npm run build` 成功とテストカバレッジを確認。

---

## 8. Acceptance Criteria | 受入判定基準

### 8.1 最低限満たすべきチェック

- [ ] `npm ci` が成功し、依存解決に失敗しない。
- [ ] `npm run lint` がエラー無しで完走。
- [ ] `npm run typecheck` が `0` で終了。
- [ ] `npm test -- --coverage --ci` が成功し、カバレッジレポートが生成。
- [ ] (必要時) `npm run build` により `dist/index.js` が生成。
- [ ] セキュリティスキャン (`npm audit --production`) の重大脆弱性が未解決でない。

### 8.2 ドキュメント & プロセス

- [ ] 変更内容に対応する README/ドキュメント更新が必要か検討し、必要なら反映。
- [ ] 新規環境変数を追加した場合は `.env.example` にプレースホルダを追加 (値は入れない)。
- [ ] PR 説明欄に実行コマンドと結果を記載。
- [ ] CI に存在しないカスタムコマンドを導入する場合は理由を説明し、チーム合意を得る。

### 8.3 セキュリティ & 運用

- [ ] Secrets をコミットしていない (レビュー時に再確認)。
- [ ] 不要なログやデバッグ出力を残していない。
- [ ] API レート制限を考慮した実装かテストで検証。

---

## 9. Appendix | 参考情報

### 9.1 Useful npm Scripts | npm スクリプト逆引き

- `npm run test:watch` : Jest をウォッチモードで実行。
- `npm run test:coverage` : カバレッジレポートを生成 (`coverage/lcov-report/index.html`)。
- `npm run lint:fix` : ESLint + Prettier 自動修正。
- `npm run clean` : ビルド成果物を削除。

### 9.2 Configuration Files | 主な設定ファイル

- `tsconfig.json` : コンパイル設定 (`target`, `module`, `paths` など)。
- `jest.config.js` : ts-jest 設定、テスト環境 (node) を指定。
- `eslint.config.js` : Flat Config。TypeScript ESLint プラグイン設定。
- `.prettierrc` : フォーマット規則 (2スペース, シングルクォート等)。
- `.husky/` : Git hooks (`pre-commit` で lint-staged を実行)。

### 9.3 External Services | 外部サービス

- **AWS Cost Explorer**: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`。
- **OpenAI**: `OPENAI_API_KEY`。
- **Anthropic**: `ANTHROPIC_API_KEY`。
- **Codecov**: CI が `coverage/lcov.info` をアップロード。
- **Trufflehog**: `security.yml` で Secrets 検出を実施。

### 9.4 Support Channels | サポート

- Issue: GitHub Issues (`https://github.com/knishioka/cost-management-mcp/issues`)。
- Security: `security.yml` のスキャン結果を参照し、必要に応じてメンテナに報告。

---

_本ドキュメントは 2025-11-03 時点の構成を基に作成されています。構成変更時は本ファイルを更新し、変更履歴を明記してください。_
