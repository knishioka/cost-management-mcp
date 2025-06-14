#!/usr/bin/env node
// Direct test of OpenAI cost retrieval functionality

const { OpenAICostClient } = require('./dist/providers/openai/client');
const { getCacheOrDefault } = require('./dist/common/cache');

async function testOpenAICosts() {
  console.log('=== Testing OpenAI Cost Retrieval Directly ===\n');

  // Check if API key is provided
  const apiKey = process.argv[2];
  if (!apiKey || apiKey === '--help') {
    console.log('Usage: node test-openai-direct.js <OPENAI_API_KEY>');
    console.log('Example: node test-openai-direct.js sk-...your-key...');
    process.exit(1);
  }

  console.log(`Using API key: ${apiKey.substring(0, 7)}...${apiKey.substring(apiKey.length - 4)}`);

  try {
    // Create client
    const client = new OpenAICostClient({ apiKey });

    // Test credential validation first
    console.log('\n1. Testing credential validation...');
    const isValid = await client.validateCredentials();
    console.log(`   Credentials valid: ${isValid ? '✅ Yes' : '❌ No'}`);

    if (!isValid) {
      console.log('\n❌ Invalid API key. Please check your OpenAI API key.');
      return;
    }

    // Get costs for last 7 days
    console.log('\n2. Fetching usage data for last 7 days...');
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);

    const result = await client.getCosts({
      startDate,
      endDate,
      granularity: 'daily',
    });

    console.log('\n✅ Successfully retrieved cost data!\n');
    console.log('=== Cost Summary ===');
    console.log(`Provider: ${result.provider}`);
    console.log(
      `Period: ${result.period.start.toISOString().split('T')[0]} to ${result.period.end.toISOString().split('T')[0]}`,
    );
    console.log(`Total Cost: $${result.costs.total.toFixed(2)} ${result.costs.currency}`);
    console.log(`Data Points: ${result.costs.breakdown.length}`);
    console.log(`Source: ${result.metadata.source}`);
    console.log(`Last Updated: ${result.metadata.lastUpdated.toISOString()}`);

    if (result.costs.breakdown.length > 0) {
      console.log('\n=== Daily Breakdown ===');
      result.costs.breakdown.forEach((item) => {
        const date = item.date ? new Date(item.date).toISOString().split('T')[0] : 'Unknown';
        console.log(`${date}: $${item.amount.toFixed(4)}`);
        if (item.usage) {
          console.log(`  - Requests: ${item.usage.quantity}`);
        }
      });
    }

    // Test the MCP tool format
    console.log('\n3. Testing MCP tool response format...');
    const { getOpenAICostsTool } = require('./dist/tools/getOpenAICosts');
    const providers = new Map([['openai', client]]);

    const toolResult = await getOpenAICostsTool(
      {
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        groupByModel: true,
        includeTokenUsage: true,
      },
      providers,
    );

    const toolData = JSON.parse(toolResult.content[0].text);
    if (toolData.success) {
      console.log('✅ MCP tool format successful');
      console.log(`   Models found: ${toolData.data.models?.length || 0}`);
      if (toolData.data.models && toolData.data.models.length > 0) {
        console.log('\n=== Model Usage ===');
        toolData.data.models.forEach((model) => {
          console.log(`${model.model}: $${model.cost.toFixed(4)}`);
        });
      }
    }
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
  }
}

testOpenAICosts();
