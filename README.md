# Cost Management MCP

[![CI](https://github.com/knishioka/cost-management-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/knishioka/cost-management-mcp/actions/workflows/ci.yml)
[![Security Scan](https://github.com/knishioka/cost-management-mcp/actions/workflows/security.yml/badge.svg)](https://github.com/knishioka/cost-management-mcp/actions/workflows/security.yml)
[![Release](https://github.com/knishioka/cost-management-mcp/actions/workflows/release.yml/badge.svg)](https://github.com/knishioka/cost-management-mcp/actions/workflows/release.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0%2B-blue.svg)](https://www.typescriptlang.org/)
[![codecov](https://codecov.io/gh/knishioka/cost-management-mcp/branch/main/graph/badge.svg)](https://codecov.io/gh/knishioka/cost-management-mcp)

A Model Context Protocol (MCP) server for unified cost management across cloud providers and API services.

[English](#english) | [日本語](#japanese)

## 🚀 Quick Examples

Once integrated with Claude Desktop, you can ask:

```
📊 "What are my AWS costs for December 2024?"
📈 "Show me OpenAI API usage trends for the last 30 days"
🤖 "What are my Anthropic API costs this month?"
🔍 "Break down my cloud expenses by service"
📋 "Which providers are currently configured?"
💰 "How much have I spent across all services this month?"
```

<a name="english"></a>

## Features

- 🔍 Unified cost tracking across AWS, OpenAI, and Anthropic
- 💾 Intelligent caching to minimize API costs
- 📊 Flexible date ranges and granularity options
- 🔐 Secure credential management via environment variables
- 🚀 Easy integration with Claude Desktop and other MCP clients
- ⚡ Written in TypeScript with full type safety
- 🧪 Comprehensive test coverage
- 🔄 Automatic retry logic with exponential backoff
- 🛡️ Security scanning with CodeQL and Trufflehog
- 📦 Automated dependency updates with Dependabot

## 🛠️ MCP Tools

This server provides three powerful tools for cost management:

### 📊 `cost_get`

**Get detailed cost breakdowns**

- Check costs for any date range
- Filter by specific provider (AWS, OpenAI, Anthropic)
- View daily, monthly, or total costs
- See service-level breakdowns

Example questions in Claude:

- "What are my AWS costs for this month?"
- "Show me daily OpenAI usage for the last week"
- "Break down my cloud costs by service"

### 📋 `provider_list`

**Check provider status**

- See which providers are configured
- Verify API credentials are valid
- Quick health check for all integrations

Example usage:

- "List all my cloud providers"
- "Which cost tracking services are active?"

### 💰 `provider_balance`

**Check remaining credits** _(Coming soon)_

- View prepaid balances
- Monitor API credit usage
- Get alerts before credits expire

### 📊 `openai_costs`

**Get detailed OpenAI usage**

- Model-by-model breakdown (GPT-4, GPT-3.5, etc.)
- Token usage statistics
- Cost optimization recommendations

Example usage:

- "Show my OpenAI costs grouped by model"
- "How many tokens did I use with GPT-4 this week?"

### 🤖 `anthropic_costs`

**Get detailed Anthropic usage**

- Model-by-model breakdown (Claude 3.5 Sonnet, Haiku, etc.)
- Token usage statistics with prompt caching details
- Cost optimization recommendations
- Support for both cost report and usage report APIs

Example usage:

- "Show my Anthropic costs grouped by model"
- "How much did I spend on Claude 3.5 Sonnet this month?"
- "What are my Anthropic costs with token-level details?"

### ☁️ `aws_costs`

**AWS cost analysis with insights**

- Service-level breakdown (EC2, S3, RDS, etc.)
- Filter by specific AWS service
- Automatic cost optimization tips
- High spend warnings

Example usage:

- "What are my EC2 costs this month?"
- "Show AWS costs grouped by service"
- "Give me AWS cost optimization tips"

### 📈 `provider_compare`

**Compare costs across providers**

- Side-by-side cost comparison
- ASCII chart visualization
- Vendor lock-in warnings
- Cost distribution insights

Example usage:

- "Compare my costs across all cloud providers"
- "Show me a chart of provider costs"
- "Which provider is most expensive?"

### 📊 `cost_trends`

**Analyze cost trends over time**

- Historical cost analysis (30d, 60d, 90d, 6m, 1y)
- Trend detection (increasing/decreasing/stable)
- Volatility analysis
- Spike detection
- Daily/weekly/monthly granularity

Example usage:

- "Show me cost trends for the last 30 days"
- "Are my AWS costs increasing?"
- "Detect any cost spikes in the past month"

### 🔍 `cost_breakdown`

**Detailed cost breakdown analysis**

- Multi-dimensional breakdown (service, region, date, tag)
- Top N cost drivers
- Percentage-based filtering
- Hierarchical drill-down
- Cost concentration analysis

Example usage:

- "Break down my costs by service"
- "Show top 5 cost drivers"
- "What services make up 80% of my costs?"

### 📅 `cost_periods`

**Compare costs between time periods**

- Period-over-period comparison
- Absolute and percentage changes
- Service-level change tracking
- Daily average comparison
- New/discontinued service detection

Example usage:

- "Compare this month vs last month"
- "How much did costs increase since Q1?"
- "Which services grew the most?"

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Available Tools](#available-tools)
  - [cost_get](#-cost_get)
  - [provider_list](#-provider_list)
  - [provider_balance](#-provider_balance)
  - [openai_costs](#-openai_costs)
  - [anthropic_costs](#-anthropic_costs)
  - [aws_costs](#️-aws_costs)
  - [provider_compare](#-provider_compare)
- [Provider Setup](#provider-setup)
- [Configuration](#configuration)
- [Development](#development)
- [Architecture](#architecture)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)

## Installation

### Prerequisites

- Node.js 18 or higher
- npm or yarn
- Active accounts with the cloud providers you want to monitor

CI currently verifies Node.js 18.x, 20.x, and 22.x. Node.js 20.x is the primary
lane for coverage upload and representative build checks.

### Steps

1. Clone the repository:

```bash
git clone https://github.com/knishioka/cost-management-mcp.git
cd cost-management-mcp
```

2. Install dependencies:

```bash
npm install
```

3. Copy the environment template:

```bash
cp .env.example .env
```

4. Edit `.env` and add your credentials (see [Provider Setup](#provider-setup))

5. Build the project:

```bash
npm run build
```

## Quick Start

### Running Standalone

```bash
# Development mode (with hot reload)
npm run dev

# Production mode
npm start
```

### Integration with Claude Desktop

1. Build the project first:

```bash
npm run build
```

2. Add to your Claude Desktop configuration (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "cost-management": {
      "command": "node",
      "args": ["/absolute/path/to/cost-management-mcp/dist/index.js"],
      "env": {
        "AWS_ACCESS_KEY_ID": "your-key",
        "AWS_SECRET_ACCESS_KEY": "your-secret",
        "AWS_REGION": "us-east-1",
        "OPENAI_API_KEY": "your-key",
        "CACHE_TTL": "3600",
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

3. Restart Claude Desktop

4. Use the tools in your conversation:

```
Can you check my AWS costs for this month?
What are my OpenAI API costs for the last 7 days?
List all my configured cloud providers.
```

### Integration with Claude Code

Claude Code supports MCP servers through two configuration methods:

#### Method 1: Project-specific configuration (Recommended)

Create a `.mcp.json` file in your project root:

```json
{
  "mcpServers": {
    "cost-management": {
      "command": "node",
      "args": ["/absolute/path/to/cost-management-mcp/dist/index.js"],
      "env": {
        "AWS_ACCESS_KEY_ID": "your-aws-access-key",
        "AWS_SECRET_ACCESS_KEY": "your-aws-secret-key",
        "AWS_REGION": "us-east-1",
        "OPENAI_API_KEY": "sk-...your-openai-key",
        "ANTHROPIC_API_KEY": "sk-ant-admin-...your-admin-key",
        "CACHE_TTL": "3600",
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

This configuration will be automatically loaded when you open the project in Claude Code.

#### Method 2: VS Code settings (Global configuration)

1. Open VS Code Settings (Cmd/Ctrl + ,)
2. Search for "Claude Code MCP Servers"
3. Click "Edit in settings.json"
4. Add the cost management server configuration:

```json
{
  "claudeCode.mcpServers": {
    "cost-management": {
      "command": "node",
      "args": ["/absolute/path/to/cost-management-mcp/dist/index.js"],
      "env": {
        "AWS_ACCESS_KEY_ID": "your-aws-access-key",
        "AWS_SECRET_ACCESS_KEY": "your-aws-secret-key",
        "AWS_REGION": "us-east-1",
        "OPENAI_API_KEY": "sk-...your-openai-key",
        "ANTHROPIC_API_KEY": "sk-ant-admin-...your-admin-key",
        "CACHE_TTL": "3600",
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

5. Reload VS Code window (Cmd/Ctrl + Shift + P → "Developer: Reload Window")

#### Using the Cost Management Server

Once configured, you can ask Claude Code about your cloud costs:

```
📊 "What are my AWS costs for this month?"
📈 "Show me OpenAI API usage trends"
🔍 "Break down my cloud expenses by service"
💰 "Compare costs across all providers"
```

**Security Note**:

- For project-specific `.mcp.json`, add it to `.gitignore` to avoid committing sensitive API keys
- Consider using environment variables or a secrets manager for production use
- The cache is optional - if not configured, the server will work without caching

## Available Tools

### cost_get

Retrieve cost data for specified providers and time periods.

**Parameters:**

- `provider` (optional): Specific provider to query ('aws', 'openai', 'anthropic')
- `startDate` (required): Start date in YYYY-MM-DD format
- `endDate` (required): End date in YYYY-MM-DD format
- `granularity` (optional): 'daily', 'monthly', or 'total' (default: 'total')
- `groupBy` (optional): Array of dimensions to group by (e.g., ['SERVICE', 'REGION'])

**Example Request:**

```json
{
  "provider": "aws",
  "startDate": "2024-01-01",
  "endDate": "2024-01-31",
  "granularity": "daily",
  "groupBy": ["SERVICE"]
}
```

**Example Response:**

```json
{
  "success": true,
  "data": {
    "provider": "aws",
    "period": {
      "start": "2024-01-01T00:00:00.000Z",
      "end": "2024-01-31T23:59:59.999Z"
    },
    "costs": {
      "total": 1234.56,
      "currency": "USD",
      "breakdown": [
        {
          "service": "Amazon EC2",
          "amount": 800.0,
          "usage": {
            "quantity": 720,
            "unit": "Hours"
          }
        },
        {
          "service": "Amazon S3",
          "amount": 434.56
        }
      ]
    },
    "metadata": {
      "lastUpdated": "2024-01-31T12:00:00.000Z",
      "source": "api"
    }
  }
}
```

### provider_list

List all configured providers and their connection status.

**Response includes:**

- Provider name
- Configuration status
- Credential validation status

**Example Response:**

```json
{
  "success": true,
  "data": {
    "providers": [
      {
        "name": "aws",
        "status": "active",
        "configured": true
      },
      {
        "name": "openai",
        "status": "active",
        "configured": true
    ],
    "configured": 2,
    "total": 3
  }
}
```

### provider_balance

Check remaining balance or credits (provider-specific).
_Note: Currently not implemented for most providers_

## Provider Setup

### AWS

1. **Enable Cost Explorer** in AWS Console
   - Navigate to AWS Cost Management → Cost Explorer
   - Click "Enable Cost Explorer" (⚠️ This action is irreversible)
   - Wait 24 hours for data to be available

2. **Create IAM User** with minimal permissions:

   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": ["ce:GetCostAndUsage", "ce:GetCostForecast", "ce:GetDimensionValues"],
         "Resource": "*"
       }
     ]
   }
   ```

3. **Set environment variables:**
   ```bash
   AWS_ACCESS_KEY_ID=your-access-key
   AWS_SECRET_ACCESS_KEY=your-secret-key
   AWS_REGION=us-east-1  # Cost Explorer only works in us-east-1
   ```

⚠️ **Important**: AWS charges $0.01 per Cost Explorer API request. Caching is enabled by default (1 hour) to minimize costs.

### OpenAI

1. **Get API Key** from [OpenAI Dashboard](https://platform.openai.com/api-keys)

2. **Ensure you have**:
   - A paid account with usage history
   - API access enabled

3. **Set environment variable**:
   ```bash
   OPENAI_API_KEY=sk-...your-api-key
   ```

⚠️ **Note**: The Usage API is relatively new (December 2024). Ensure your account has access.

### Anthropic

1. **Get Admin API Key** from [Anthropic Console](https://console.anthropic.com/)

2. **Requirements**:
   - Organization account (individual accounts are not supported)
   - Admin role to provision Admin API keys
   - Admin API key starts with `sk-ant-admin...` (different from regular API keys)

3. **Set environment variable**:
   ```bash
   ANTHROPIC_API_KEY=sk-ant-admin-...your-admin-api-key
   ```

⚠️ **Important Notes**:

- Only Admin API keys can access cost and usage data
- Cost data is available through two APIs:
  - **Cost Report API**: Provides actual billing data in USD
  - **Usage Report API**: Provides token-level details with calculated costs
- Data typically appears within 5 minutes of API request completion
- Supports prompt caching cost tracking

## Configuration

### Environment Variables

| Variable                | Description                           | Default   | Required       |
| ----------------------- | ------------------------------------- | --------- | -------------- |
| `AWS_ACCESS_KEY_ID`     | AWS access key                        | -         | For AWS        |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key                        | -         | For AWS        |
| `AWS_REGION`            | AWS region                            | us-east-1 | For AWS        |
| `OPENAI_API_KEY`        | OpenAI API key                        | -         | For OpenAI     |
| `ANTHROPIC_API_KEY`     | Anthropic Admin API key               | -         | For Anthropic  |
| `CACHE_TTL`             | Cache time-to-live in seconds         | 3600      | No             |
| `CACHE_TYPE`            | Cache backend (memory/redis)          | memory    | No             |
| `REDIS_URL`             | Redis connection URL                  | -         | If using Redis |
| `LOG_LEVEL`             | Log verbosity (debug/info/warn/error) | info      | No             |
| `MCP_SERVER_PORT`       | Server port                           | 3000      | No             |

### Cache Configuration

The cache helps reduce API costs and improve performance:

- **Memory Cache** (default): Fast, no setup required, data lost on restart
- **Redis Cache**: Persistent, shared across instances, requires Redis server

To use Redis:

```bash
CACHE_TYPE=redis
REDIS_URL=redis://localhost:6379
```

### Logging

Structured JSON logging is used for easy parsing:

```bash
# View logs in development
npm run dev

# View logs in production with jq
npm start 2>&1 | jq '.'

# Filter errors only
npm start 2>&1 | jq 'select(.level == "error")'
```

## Development

### Project Structure

```
cost-management-mcp/
├── src/
│   ├── common/          # Shared utilities and types
│   │   ├── cache.ts     # Caching implementation
│   │   ├── config.ts    # Configuration management
│   │   ├── errors.ts    # Custom error classes
│   │   ├── types.ts     # TypeScript interfaces
│   │   └── utils.ts     # Helper functions
│   ├── providers/       # Provider implementations
│   │   ├── aws/         # AWS Cost Explorer
│   │   ├── openai/      # OpenAI Usage API
│   │   ├── anthropic/   # Anthropic Admin API
│   ├── tools/           # MCP tool implementations
│   │   ├── getCosts.ts
│   │   ├── listProviders.ts
│   │   └── checkBalance.ts
│   ├── server.ts        # MCP server setup
│   └── index.ts         # Entry point
├── tests/               # Test files
├── docs/                # Additional documentation
└── scripts/             # Utility scripts
```

### Commands

```bash
# Development with hot reload
npm run dev

# Build TypeScript to JavaScript
npm run build

# Run production server
npm start

# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch

# Lint code
npm run lint

# Fix linting issues
npm run lint:fix

# Type check without building
npm run typecheck

# Clean build artifacts
npm run clean
```

### Adding a New Provider

1. Create provider directory:

```bash
mkdir -p src/providers/newprovider
```

2. Implement required files:

- `types.ts` - TypeScript interfaces
- `transformer.ts` - Convert API response to unified format
- `client.ts` - API client implementing `ProviderClient`
- `index.ts` - Public exports

3. Update server.ts to include the new provider

4. Add tests in `tests/providers/newprovider/`

### Testing

Tests use Jest with TypeScript support:

```bash
# Run all tests
npm test

# Run tests for specific provider
npm test -- aws

# Run with coverage
npm run test:coverage

# Debug tests
node --inspect-brk node_modules/.bin/jest --runInBand
```

## Architecture

### Design Principles

1. **Unified Interface**: All providers implement the same `ProviderClient` interface
2. **Error Resilience**: Automatic retry with exponential backoff
3. **Cost Optimization**: Aggressive caching to minimize API calls
4. **Type Safety**: Full TypeScript coverage with strict mode
5. **Extensibility**: Easy to add new providers or tools

### Data Flow

```
User Request → MCP Tool → Provider Client → Cache Check
                                              ↓ (miss)
                                          External API
                                              ↓
                                          Transformer
                                              ↓
                                          Cache Store
                                              ↓
                                          Response
```

### Error Handling

The system implements a hierarchical error handling strategy:

1. **Provider Errors**: Specific to each cloud provider
2. **Authentication Errors**: Invalid or expired credentials
3. **Rate Limit Errors**: Automatic retry with backoff
4. **Validation Errors**: Invalid input parameters
5. **Network Errors**: Retryable connection issues

## Troubleshooting

### Common Issues

#### "Authentication failed" error

- Verify your API keys/credentials are correct
- Check if the credentials have the required permissions
- For AWS, ensure you're using us-east-1 region for Cost Explorer

#### No cost data returned

- AWS: Wait 24 hours after enabling Cost Explorer
- OpenAI: Verify you have a paid account with usage

#### High AWS costs

- Cost Explorer API charges $0.01 per request
- Increase `CACHE_TTL` to reduce API calls
- Use Redis cache for persistence across restarts

#### "Rate limit exceeded" error

- The system automatically retries with exponential backoff
- If persistent, check your API quotas
- Consider increasing cache TTL

### Debug Mode

Enable debug logging for more information:

```bash
LOG_LEVEL=debug npm run dev
```

### Health Check

Test individual providers:

```bash
# In your MCP client
Use the provider_list tool to check all providers
```

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Workflow

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass: `npm test`
6. Lint your code: `npm run lint`
7. Commit with descriptive message
8. Push to your fork and submit a PR

### Code Style

- Follow TypeScript best practices
- Use meaningful variable names
- Add JSDoc comments for public APIs
- Keep functions small and focused
- Write tests for new features

## 📊 Project Status

### Build & Test

- **CI/CD**: Automated testing on push and PR
- **Node Support**: Runtime floor is Node.js 18+. CI verifies 18.x, 20.x, and
  22.x with 20.x as the primary lane for coverage upload and representative
  build checks.
- **Coverage**: Comprehensive test suite with coverage reporting

### Security

- **Dependency Scanning**: Weekly automated updates
- **Secret Detection**: Continuous monitoring for exposed credentials
- **Code Analysis**: CodeQL security scanning

### Quality

- **Type Safety**: Strict TypeScript configuration
- **Linting**: ESLint with auto-fix on commit
- **Formatting**: Prettier code formatting

## License

MIT License - see [LICENSE](LICENSE) file for details

---

<a name="japanese"></a>

## 日本語ドキュメント

### 概要

Cost Management MCPは、複数のクラウドプロバイダーとAPIサービスのコストを統一的に管理するためのModel Context Protocol (MCP)サーバーです。

### 主な機能

- 🔍 AWS、OpenAI、Anthropicのコストを一元管理
- 💾 APIコストを最小限に抑えるインテリジェントキャッシング
- 📊 柔軟な日付範囲と集計オプション
- 🔐 環境変数による安全な認証情報管理
- 🚀 Claude Desktopとの簡単な統合
- ⚡ TypeScriptによる型安全性
- 🧪 包括的なテストカバレッジ
- 🔄 指数バックオフによる自動リトライ
- 🛡️ CodeQLとTrufflehogによるセキュリティスキャン
- 📦 Dependabotによる自動依存関係更新

### 🛠️ 利用可能なMCPツール

このサーバーは、コスト管理のための3つの強力なツールを提供します：

### 📊 `cost.get`

**詳細なコスト内訳を取得**

- 任意の期間のコストをチェック
- 特定のプロバイダー（AWS、OpenAI）でフィルタリング
- 日次、月次、または合計コストを表示
- サービスレベルの内訳を確認

Claudeでの使用例：

- 「今月のAWSのコストを教えて」
- 「過去1週間のOpenAIの日次使用量を表示して」
- 「クラウドコストをサービス別に分解して」

### 📋 `provider_list`

**プロバイダーの状態を確認**

- 設定されているプロバイダーを確認
- API認証情報が有効かを検証
- すべての統合のヘルスチェック

使用例：

- 「すべてのクラウドプロバイダーを一覧表示」
- 「どのコスト追跡サービスがアクティブ？」

### 💰 `provider_balance`

**残高の確認** _(近日公開)_

- プリペイド残高の表示
- APIクレジット使用量の監視
- クレジット期限前のアラート

### インストール

#### 前提条件

- Node.js 18 以上
- npm または yarn
- 監視対象クラウドプロバイダーのアカウント

CI は現在 Node.js 18.x / 20.x / 22.x を検証しており、20.x を
カバレッジアップロードおよび代表的なビルド検証用の主要レーンとして扱います。

```bash
# リポジトリのクローン
git clone https://github.com/knishioka/cost-management-mcp.git
cd cost-management-mcp

# 依存関係のインストール
npm install

# 環境変数の設定
cp .env.example .env
# .envファイルを編集して認証情報を追加

# ビルド
npm run build
```

### Claude Desktopとの統合

Claude Desktopの設定ファイルに以下を追加：

```json
{
  "mcpServers": {
    "cost-management": {
      "command": "node",
      "args": ["/path/to/cost-management-mcp/dist/index.js"],
      "env": {
        "AWS_ACCESS_KEY_ID": "your-key",
        "AWS_SECRET_ACCESS_KEY": "your-secret",
        "OPENAI_API_KEY": "your-key"
      }
    }
  }
}
```

### Claude Codeとの統合

Claude Codeは2つの設定方法でMCPサーバーをサポートしています：

#### 方法1: プロジェクト固有の設定（推奨）

プロジェクトのルートディレクトリに `.mcp.json` ファイルを作成：

```json
{
  "mcpServers": {
    "cost-management": {
      "command": "node",
      "args": ["/absolute/path/to/cost-management-mcp/dist/index.js"],
      "env": {
        "AWS_ACCESS_KEY_ID": "your-aws-access-key",
        "AWS_SECRET_ACCESS_KEY": "your-aws-secret-key",
        "AWS_REGION": "us-east-1",
        "OPENAI_API_KEY": "sk-...your-openai-key",
        "ANTHROPIC_API_KEY": "sk-ant-admin-...your-admin-key",
        "CACHE_TTL": "3600",
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

この設定は、Claude Codeでプロジェクトを開いたときに自動的に読み込まれます。

#### 方法2: VS Code設定（グローバル設定）

1. VS Code設定を開く（Cmd/Ctrl + ,）
2. 「Claude Code MCP Servers」を検索
3. 「settings.jsonで編集」をクリック
4. コスト管理サーバーの設定を追加：

```json
{
  "claudeCode.mcpServers": {
    "cost-management": {
      "command": "node",
      "args": ["/absolute/path/to/cost-management-mcp/dist/index.js"],
      "env": {
        "AWS_ACCESS_KEY_ID": "your-aws-access-key",
        "AWS_SECRET_ACCESS_KEY": "your-aws-secret-key",
        "AWS_REGION": "us-east-1",
        "OPENAI_API_KEY": "sk-...your-openai-key",
        "GOOGLE_APPLICATION_CREDENTIALS": "/path/to/gcp-service-account.json",
        "GCP_BILLING_ACCOUNT_ID": "your-billing-account-id"
      }
    }
  }
}
```

5. VS Codeウィンドウをリロード（Cmd/Ctrl + Shift + P → 「開発者: ウィンドウの再読み込み」）

#### コスト管理サーバーの使用

設定が完了したら、Claude Codeでクラウドコストについて質問できます：

```
📊 「今月のAWSコストを教えて」
📈 「OpenAI APIの使用傾向を表示」
🔍 「サービス別にクラウド費用を分析」
💰 「全プロバイダーのコストを比較」
```

**セキュリティに関する注意**:

- プロジェクト固有の `.mcp.json` は `.gitignore` に追加して、APIキーをコミットしないようにしてください
- 本番環境では環境変数やシークレット管理ツールの使用を検討してください
- キャッシュはオプションです - 設定されていない場合、サーバーはキャッシュなしで動作します

### 使用例

```
今月のAWSのコストを教えて
過去7日間のOpenAI APIの使用料金は？
設定されているクラウドプロバイダーを一覧表示して
```

### プロバイダーの設定

各プロバイダーの詳細な設定方法は[英語版ドキュメント](#provider-setup)を参照してください。

### 開発

```bash
# 開発モード（ホットリロード付き）
npm run dev

# テストの実行
npm test

# リントチェック
npm run lint

# 型チェック
npm run typecheck
```

### 📊 プロジェクトステータス

### ビルド＆テスト

- **CI/CD**: プッシュとPR時の自動テスト
- **Node サポート**: 動作要件（runtime floor）は Node.js 18+。CI は 18.x / 20.x / 22.x を検証し、
  20.x を主要なカバレッジアップロードおよびビルド検証用レーン（primary coverage lane）として扱います
- **カバレッジ**: カバレッジレポート付きの包括的なテストスイート

### セキュリティ

- **依存関係スキャン**: 週次自動更新
- **シークレット検出**: 公開された認証情報の継続的監視
- **コード分析**: CodeQLセキュリティスキャン

### 品質

- **型安全性**: 厳格なTypeScript設定
- **リンティング**: コミット時のESLint自動修正
- **フォーマット**: Prettierコードフォーマット

### ライセンス

MIT License

---

Built with ❤️ using TypeScript and MCP
