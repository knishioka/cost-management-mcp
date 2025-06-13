# Contributing to Cost Management MCP

Thank you for your interest in contributing to Cost Management MCP! This document provides guidelines and instructions for contributing.

## Code of Conduct

By participating in this project, you agree to abide by our Code of Conduct:
- Be respectful and inclusive
- Welcome newcomers and help them get started
- Focus on constructive criticism
- Respect differing viewpoints and experiences

## How to Contribute

### Reporting Issues

1. Check if the issue already exists in the [issue tracker](https://github.com/yourusername/cost-management-mcp/issues)
2. If not, create a new issue with:
   - Clear, descriptive title
   - Detailed description of the problem
   - Steps to reproduce
   - Expected vs actual behavior
   - Environment details (OS, Node version, etc.)

### Suggesting Features

1. Check existing issues and discussions
2. Create a feature request issue with:
   - Use case description
   - Proposed solution
   - Alternative solutions considered
   - Potential impact on existing features

### Submitting Code

#### Setup Development Environment

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/yourusername/cost-management-mcp.git
   cd cost-management-mcp
   ```
3. Add upstream remote:
   ```bash
   git remote add upstream https://github.com/originalowner/cost-management-mcp.git
   ```
4. Install dependencies:
   ```bash
   npm install
   ```

#### Development Workflow

1. Create a feature branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Make your changes following our coding standards

3. Write/update tests:
   ```bash
   npm test
   ```

4. Run linting:
   ```bash
   npm run lint
   npm run typecheck
   ```

5. Commit your changes:
   ```bash
   git add .
   git commit -m "feat: add new feature"
   ```
   
   Follow [Conventional Commits](https://www.conventionalcommits.org/):
   - `feat:` New feature
   - `fix:` Bug fix
   - `docs:` Documentation changes
   - `style:` Code style changes (formatting, etc.)
   - `refactor:` Code refactoring
   - `test:` Test additions or modifications
   - `chore:` Build process or auxiliary tool changes

6. Push to your fork:
   ```bash
   git push origin feature/your-feature-name
   ```

7. Create a Pull Request

#### Pull Request Guidelines

- Fill out the PR template completely
- Link related issues
- Ensure all tests pass
- Keep PR focused on a single feature/fix
- Update documentation as needed
- Be responsive to review feedback

### Coding Standards

#### TypeScript

- Use TypeScript strict mode
- Avoid `any` types
- Use explicit return types for functions
- Prefer `const` over `let`
- Use meaningful variable names

#### Code Style

```typescript
// Good
export async function getCostData(
  provider: Provider,
  params: CostQueryParams,
): Promise<UnifiedCostData> {
  // Implementation
}

// Bad
export async function getData(p, params) {
  // Implementation
}
```

#### Testing

- Write unit tests for all new functions
- Test edge cases and error conditions
- Mock external dependencies
- Aim for 80%+ code coverage

Example test:
```typescript
describe('getCostData', () => {
  it('should return cached data when available', async () => {
    // Arrange
    const mockCache = { get: jest.fn().mockResolvedValue(cachedData) };
    
    // Act
    const result = await getCostData('aws', params);
    
    // Assert
    expect(result).toEqual(cachedData);
    expect(mockCache.get).toHaveBeenCalledWith('aws', params);
  });
});
```

#### Documentation

- Add JSDoc comments for public APIs
- Update README for new features
- Include examples in documentation
- Keep CLAUDE.md updated for AI assistance

### Adding a New Provider

1. Create provider structure:
   ```
   src/providers/newprovider/
   ├── types.ts      # TypeScript interfaces
   ├── client.ts     # API client implementation
   ├── transformer.ts # Data transformation logic
   └── index.ts      # Public exports
   ```

2. Implement `ProviderClient` interface:
   ```typescript
   export class NewProviderClient implements ProviderClient {
     async getCosts(params: CostQueryParams): Promise<UnifiedCostData> {
       // Implementation
     }
     
     async validateCredentials(): Promise<boolean> {
       // Implementation
     }
     
     getProviderName(): Provider {
       return 'newprovider';
     }
   }
   ```

3. Add to server configuration in `src/server.ts`

4. Write comprehensive tests

5. Update documentation

### Release Process

1. Maintainers will review and merge PRs
2. Releases follow semantic versioning
3. Changelog is automatically generated from commit messages
4. NPM package is published by maintainers

## Getting Help

- Check the [documentation](README.md)
- Look through existing issues
- Ask questions in discussions
- Reach out to maintainers

## Recognition

Contributors will be recognized in:
- GitHub contributors list
- Release notes
- Special mentions for significant contributions

Thank you for contributing to Cost Management MCP! 🎉