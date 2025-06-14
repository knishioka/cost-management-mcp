#!/usr/bin/env node
require('dotenv').config();
const { OpenAICostClient } = require('./dist/providers/openai/client');
const { initializeCache } = require('./dist/common/cache');

async function testOpenAI() {
  console.log('Testing OpenAI API connection...\n');

  // Check if API key is loaded
  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY is not set in environment variables');
    return;
  }

  console.log('✅ OPENAI_API_KEY is loaded');
  console.log(`   Key length: ${process.env.OPENAI_API_KEY.length} characters`);
  console.log(`   Key prefix: ${process.env.OPENAI_API_KEY.substring(0, 7)}...`);

  // Initialize cache
  initializeCache({ type: 'memory', ttl: 3600 });
  console.log('✅ Cache initialized');

  try {
    // Create client
    const client = new OpenAICostClient({ apiKey: process.env.OPENAI_API_KEY });
    console.log('\n✅ OpenAI client created successfully');

    // Test API connection
    console.log('\n📊 Fetching usage data for the last 7 days...');

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);

    const result = await client.getCosts({
      startDate,
      endDate,
      granularity: 'daily',
    });

    console.log('\n✅ API call successful!');
    console.log('\n📈 Usage Summary:');
    console.log(`   Provider: ${result.provider}`);
    console.log(
      `   Period: ${result.period.start.toISOString().split('T')[0]} to ${result.period.end.toISOString().split('T')[0]}`,
    );
    console.log(`   Total Cost: $${result.costs.total.toFixed(2)} ${result.costs.currency}`);
    console.log(`   Data Points: ${result.costs.breakdown.length}`);

    if (result.costs.breakdown.length > 0) {
      console.log('\n📊 Daily Breakdown:');
      result.costs.breakdown.slice(0, 5).forEach((item) => {
        const date = item.date ? new Date(item.date).toISOString().split('T')[0] : 'Unknown';
        console.log(
          `   ${date}: $${item.amount.toFixed(2)} - ${item.service || 'Unknown service'}`,
        );
      });

      if (result.costs.breakdown.length > 5) {
        console.log(`   ... and ${result.costs.breakdown.length - 5} more entries`);
      }
    }

    // Test validate credentials
    console.log('\n🔐 Testing credential validation...');
    const isValid = await client.validateCredentials();
    console.log(`   Credentials valid: ${isValid ? '✅ Yes' : '❌ No'}`);
  } catch (error) {
    console.error('\n❌ Error testing OpenAI API:');
    console.error(`   ${error.message}`);
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Data: ${JSON.stringify(error.response.data, null, 2)}`);
    }
    if (error.stack) {
      console.error('\n   Stack trace:');
      console.error(
        error.stack
          .split('\n')
          .map((line) => '   ' + line)
          .join('\n'),
      );
    }
  }
}

testOpenAI();
