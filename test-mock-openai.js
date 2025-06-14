#!/usr/bin/env node
// Mock test to demonstrate expected behavior with valid API key

// No need to initialize cache for this mock test

console.log('=== OpenAI Cost Retrieval Mock Test ===\n');

// Simulate the MCP tool response
const mockResponse = {
  success: true,
  data: {
    provider: 'openai',
    period: {
      start: '2025-06-07',
      end: '2025-06-14',
    },
    costs: {
      total: 24.85,
      currency: 'USD',
      breakdown: [],
    },
    models: [
      {
        model: 'gpt-4',
        cost: 18.5,
        usage: {
          totalTokens: 125000,
          promptTokens: 85000,
          completionTokens: 40000,
        },
      },
      {
        model: 'gpt-3.5-turbo',
        cost: 4.35,
        usage: {
          totalTokens: 890000,
          promptTokens: 650000,
          completionTokens: 240000,
        },
      },
      {
        model: 'text-embedding-ada-002',
        cost: 2.0,
        usage: {
          totalTokens: 5000000,
          promptTokens: 5000000,
          completionTokens: 0,
        },
      },
    ],
    dailyUsage: [
      { date: '2025-06-07', cost: 3.25, requests: 45 },
      { date: '2025-06-08', cost: 2.8, requests: 38 },
      { date: '2025-06-09', cost: 4.15, requests: 52 },
      { date: '2025-06-10', cost: 3.9, requests: 48 },
      { date: '2025-06-11', cost: 2.75, requests: 35 },
      { date: '2025-06-12', cost: 3.5, requests: 42 },
      { date: '2025-06-13', cost: 4.5, requests: 55 },
    ],
  },
};

console.log('Provider:', mockResponse.data.provider);
console.log('Period:', `${mockResponse.data.period.start} to ${mockResponse.data.period.end}`);
console.log('Total Cost:', `$${mockResponse.data.costs.total} ${mockResponse.data.costs.currency}`);
console.log('\n=== Model Breakdown ===');

mockResponse.data.models.forEach((model) => {
  console.log(`\n${model.model}:`);
  console.log(`  Cost: $${model.cost.toFixed(2)}`);
  console.log(`  Total Tokens: ${model.usage.totalTokens.toLocaleString()}`);
  console.log(`  Prompt Tokens: ${model.usage.promptTokens.toLocaleString()}`);
  console.log(`  Completion Tokens: ${model.usage.completionTokens.toLocaleString()}`);
});

console.log('\n=== Daily Usage (Last 7 Days) ===');
mockResponse.data.dailyUsage.forEach((day) => {
  console.log(`${day.date}: $${day.cost.toFixed(2)} (${day.requests} requests)`);
});

console.log('\n=== How to Use with Real API Key ===');
console.log('\n1. Set environment variable in MCP client config:');
console.log('   "env": { "OPENAI_API_KEY": "sk-..." }');
console.log('\n2. Or for testing, run:');
console.log('   OPENAI_API_KEY=sk-... node dist/index.js');
console.log('\n3. Then use the tools:');
console.log('   - openai.costs: Get detailed costs with model breakdown');
console.log('   - cost.get: Get costs for any provider');
console.log('   - cost.trends: Analyze spending trends');
