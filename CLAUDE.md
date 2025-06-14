# Claude Development Guidelines for Cost Management MCP

## Project Overview

This is a Model Context Protocol (MCP) server that provides unified cost monitoring across multiple cloud and API providers (AWS, GCP, OpenAI). The server allows users to retrieve cost data, monitor usage, and track expenses across different services through a consistent interface.

## Key Commands

### Development

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build TypeScript to JavaScript
- `npm run test` - Run all tests
- `npm run lint` - Check code style
- `npm run typecheck` - Check TypeScript types

### Before Committing

Pre-commit hooks are configured to automatically run checks:

- **ESLint** - Automatically fixes code style issues
- **Prettier** - Formats code for consistency

The hooks run automatically on `git commit`. To run checks manually:

```bash
npm run lint
npm run typecheck
npm test
```

If you need to bypass hooks temporarily (not recommended):

```bash
git commit --no-verify -m "your message"
```

## Architecture Overview

### Provider Structure

Each provider (AWS, GCP, OpenAI) has:

- `client.ts` - API client implementation
- `types.ts` - TypeScript type definitions
- `transformer.ts` - Transforms provider data to unified format

### Unified Data Model

```typescript
interface UnifiedCostData {
  provider: 'aws' | 'gcp' | 'openai';
  period: { start: Date; end: Date };
  costs: {
    total: number;
    currency: string;
    breakdown: Array<{
      service: string;
      amount: number;
      usage?: { quantity: number; unit: string };
    }>;
  };
  metadata: {
    lastUpdated: Date;
    source: 'api' | 'cache' | 'manual';
  };
}
```

## Implementation Guidelines

### Error Handling

- Always use custom error classes from `src/common/errors.ts`
- Implement retry logic with exponential backoff for API calls
- Log errors appropriately without exposing sensitive data
- Provide meaningful error messages to users

### Caching Strategy

- Cache all API responses to minimize costs (especially AWS at $0.01/request)
- Default TTL: 1 hour (configurable via CACHE_TTL env var)
- Implement cache invalidation on demand
- Use separate cache keys for each provider/query combination

### Security Best Practices

- **NEVER** log API keys or sensitive credentials
- All credentials must come from environment variables
- Validate all user inputs using Zod schemas
- Use least privilege permissions for cloud APIs
- No hardcoded URLs or credentials in code

### Testing Requirements

- Write unit tests for all business logic
- Mock external API calls in tests
- Aim for minimum 80% code coverage
- Test error scenarios and edge cases
- Use descriptive test names

### Code Style

- Use TypeScript strict mode
- No `any` types allowed
- Use explicit return types for functions
- Prefer `const` over `let`
- Use meaningful variable names
- Keep functions small and focused

## MCP Tool Implementation

### Available Tools

1. `cost_get` - Retrieve costs for a specific period
2. `provider_list` - List configured providers
3. `provider_balance` - Check provider balance/credits
4. `openai_costs` - Get detailed OpenAI usage data
5. `aws_costs` - Get detailed AWS cost analysis
6. `provider_compare` - Compare costs across providers
7. `cost_trends` - Analyze cost trends over time
8. `cost_breakdown` - Get detailed cost breakdown
9. `cost_periods` - Compare costs between time periods

### MCP Tool Naming Convention

**IMPORTANT**: All MCP tool names must follow the pattern `^[a-zA-Z0-9_-]{1,64}$`

- ✅ Valid: `cost_get`, `provider_list`, `aws_costs`
- ❌ Invalid: `cost.get`, `provider.list`, `aws.costs` (dots not allowed)

This is a strict MCP requirement. Tool names containing dots (.) will cause API errors:

```
"tools.16.custom.name: String should match pattern '^[a-zA-Z0-9_-]{1,64}$'"
```

When adding new tools:

- Use underscores (\_) instead of dots (.)
- Use hyphens (-) for word separation if needed
- Keep names under 64 characters
- Use only alphanumeric characters, underscores, and hyphens

### Tool Response Format

```typescript
{
  success: boolean;
  data?: any;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}
```

## Provider-Specific Notes

### AWS

- Uses AWS SDK v3
- Requires Cost Explorer to be enabled (irreversible)
- API calls cost $0.01 each - implement aggressive caching
- Authentication via IAM credentials

### Google Cloud

- Uses official @google-cloud/billing library
- Supports Application Default Credentials (ADC)
- Free API calls but has rate limits
- Requires billing.accounts.get permission

### OpenAI

- New Usage API (December 2024)
- REST API with Bearer token auth
- Provides granular usage data
- Can filter by API key, project, model

## Environment Setup

### Required Environment Variables

```bash
# AWS
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=us-east-1

# GCP
GOOGLE_APPLICATION_CREDENTIALS=path/to/service-account.json
GCP_BILLING_ACCOUNT_ID=

# OpenAI
OPENAI_API_KEY=

# Cache
CACHE_TTL=3600
CACHE_TYPE=memory
```

### Local Development

1. Copy `.env.example` to `.env`
2. Fill in your API credentials
3. Run `npm install`
4. Run `npm run dev` to start development server

## Common Patterns

### API Client Pattern

```typescript
class ProviderClient {
  constructor(private config: ProviderConfig) {}

  async getCosts(params: CostParams): Promise<ProviderCostData> {
    // 1. Check cache
    // 2. Make API call with retry logic
    // 3. Transform response
    // 4. Cache result
    // 5. Return data
  }
}
```

### Error Handling Pattern

```typescript
try {
  const result = await apiCall();
  return result;
} catch (error) {
  if (isRetryableError(error)) {
    return retry(apiCall, { maxAttempts: 3 });
  }
  throw new ProviderError('Failed to fetch data', { cause: error });
}
```

## Debugging Tips

### Logging

- Use structured logging with correlation IDs
- Log at appropriate levels (debug, info, warn, error)
- Include context but never sensitive data
- Use `LOG_LEVEL` env var to control verbosity

### Common Issues

1. **Authentication failures** - Check env vars and permissions
2. **Rate limits** - Implement exponential backoff
3. **Cache misses** - Verify cache configuration
4. **Data transformation** - Log intermediate states

## Performance Considerations

### API Optimization

- Batch requests where possible
- Use pagination efficiently
- Implement request queuing
- Monitor rate limit headers

### Memory Management

- Stream large responses
- Implement data pagination
- Clear cache of old entries
- Monitor memory usage

## Development Workflow

### Git Commit Process

1. Stage your changes: `git add .`
2. Commit your changes: `git commit -m "your message"`
3. Pre-commit hooks will automatically:
   - Run ESLint and fix issues
   - Format code with Prettier
   - Block commit if there are unfixable errors
4. Fix any errors and retry if needed

### Commit Message Format

Follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` New features
- `fix:` Bug fixes
- `docs:` Documentation changes
- `chore:` Maintenance tasks
- `test:` Test additions/changes
- `refactor:` Code refactoring

Example: `feat: add cost forecasting for AWS provider`

## Release Checklist

Before releasing:

1. [ ] All tests passing (`npm test`)
2. [ ] No linting errors (`npm run lint`)
3. [ ] TypeScript compilation successful (`npm run build`)
4. [ ] Documentation updated
5. [ ] Environment variables documented
6. [ ] Error messages are user-friendly
7. [ ] Sensitive data not logged
8. [ ] Performance tested with real data
9. [ ] Pre-commit hooks passing

## Future Enhancements

Planned improvements:

- Web dashboard for visualization
- Cost alerts and notifications
- Budget tracking features
- Multi-account support
- Historical trend analysis
- Cost optimization recommendations
- Support for Azure and other providers
