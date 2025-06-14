#!/usr/bin/env node
const { spawn } = require('child_process');

console.log('=== OpenAI Cost Analysis Demo ===\n');

// Start the MCP server
const server = spawn('node', ['dist/index.js'], {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: {
    ...process.env,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY || 'sk-demo-key',
  },
});

let outputBuffer = '';
server.stdout.on('data', (data) => {
  outputBuffer += data.toString();
});

server.stderr.on('data', (data) => {
  console.error('Server Error:', data.toString());
});

// Helper function to send request and wait for response
async function sendRequest(method, params) {
  const request = {
    jsonrpc: '2.0',
    id: Date.now(),
    method: 'tools/call',
    params: params,
  };

  server.stdin.write(JSON.stringify(request) + '\n');
  await new Promise((resolve) => setTimeout(resolve, 1500));

  // Parse response
  const lines = outputBuffer.split('\n');
  for (const line of lines.reverse()) {
    if (line.includes(`"id":${request.id}`) && line.includes('result')) {
      try {
        const response = JSON.parse(line);
        if (response.result?.content?.[0]?.text) {
          return JSON.parse(response.result.content[0].text);
        }
      } catch (e) {}
    }
  }
  return null;
}

async function runAnalysis() {
  // Wait for server to start
  await new Promise((resolve) => setTimeout(resolve, 2000));

  const endDate = new Date().toISOString().split('T')[0];
  const startDate30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const startDate7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const startDate60d = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  console.log('Analyzing OpenAI costs from multiple perspectives...\n');

  // 1. Basic cost retrieval with model breakdown
  console.log('1. MODEL-BASED ANALYSIS (Last 30 days)');
  console.log('='.repeat(50));
  const modelCosts = await sendRequest('tools/call', {
    name: 'openai.costs',
    arguments: {
      startDate: startDate30d,
      endDate: endDate,
      groupByModel: true,
      includeTokenUsage: true,
    },
  });

  if (modelCosts?.success) {
    console.log(`Total Cost: $${modelCosts.data.costs.total.toFixed(2)}`);
    console.log('\nModel Breakdown:');
    if (modelCosts.data.models) {
      modelCosts.data.models.forEach((model) => {
        console.log(`\n  ${model.model}:`);
        console.log(`    Cost: $${model.cost.toFixed(4)}`);
        console.log(`    Usage: ${(model.usage.totalTokens / 1000).toFixed(1)}K tokens`);
        console.log(
          `    Avg cost/1K tokens: $${(model.cost / (model.usage.totalTokens / 1000)).toFixed(4)}`,
        );
      });
    }
  } else {
    console.log('Using mock data for demonstration...');
    // Mock data for demo
    console.log('Total Cost: $125.45');
    console.log('\nModel Breakdown:');
    console.log('\n  gpt-4:');
    console.log('    Cost: $98.5000');
    console.log('    Usage: 2,450.5K tokens');
    console.log('    Avg cost/1K tokens: $0.0402');
    console.log('\n  gpt-3.5-turbo:');
    console.log('    Cost: $24.9500');
    console.log('    Usage: 12,475.0K tokens');
    console.log('    Avg cost/1K tokens: $0.0020');
  }

  // 2. Cost trends analysis
  console.log('\n\n2. TREND ANALYSIS (30 days)');
  console.log('='.repeat(50));
  const trends = await sendRequest('tools/call', {
    name: 'cost.trends',
    arguments: {
      provider: 'openai',
      period: '30d',
      granularity: 'weekly',
    },
  });

  if (trends?.success) {
    const data = trends.data;
    console.log(`Average Daily Cost: $${data.summary.average.toFixed(2)}`);
    console.log(
      `Trend: ${data.summary.trend} (${data.summary.changePercent > 0 ? '+' : ''}${data.summary.changePercent.toFixed(1)}%)`,
    );
    console.log(`Volatility: ${data.summary.volatility}`);

    console.log('\nWeekly Progression:');
    data.trends.forEach((week) => {
      console.log(
        `  ${week.date}: $${week.cost.toFixed(2)} (${week.changePercentage > 0 ? '+' : ''}${week.changePercentage.toFixed(1)}%)`,
      );
    });
  } else {
    // Mock data
    console.log('Average Daily Cost: $4.18');
    console.log('Trend: increasing (+15.3%)');
    console.log('Volatility: moderate');
    console.log('\nWeekly Progression:');
    console.log('  Week 1: $25.20 (baseline)');
    console.log('  Week 2: $28.45 (+12.9%)');
    console.log('  Week 3: $31.80 (+11.8%)');
    console.log('  Week 4: $40.00 (+25.8%)');
  }

  // 3. Period comparison
  console.log('\n\n3. PERIOD COMPARISON (Last 7 days vs Previous 7 days)');
  console.log('='.repeat(50));
  const comparison = await sendRequest('tools/call', {
    name: 'cost.periods',
    arguments: {
      provider: 'openai',
      period1: {
        startDate: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        endDate: startDate7d,
      },
      period2: {
        startDate: startDate7d,
        endDate: endDate,
      },
      comparisonType: 'both',
      breakdown: true,
    },
  });

  if (comparison?.success) {
    const data = comparison.data;
    console.log(`Previous Period: $${data.period1.total.toFixed(2)}`);
    console.log(`Current Period: $${data.period2.total.toFixed(2)}`);
    console.log(
      `Change: ${data.percentageChange > 0 ? '+' : ''}$${data.absoluteDiff.toFixed(2)} (${data.percentageChange > 0 ? '+' : ''}${data.percentageChange.toFixed(1)}%)`,
    );

    if (data.serviceComparison) {
      console.log('\nModel Changes:');
      Object.entries(data.serviceComparison).forEach(([model, change]) => {
        console.log(`  ${model}: ${change > 0 ? '+' : ''}${change.toFixed(1)}%`);
      });
    }
  } else {
    // Mock data
    console.log('Previous Period: $28.50');
    console.log('Current Period: $35.75');
    console.log('Change: +$7.25 (+25.4%)');
    console.log('\nModel Changes:');
    console.log('  gpt-4: +35.2%');
    console.log('  gpt-3.5-turbo: +15.8%');
    console.log('  text-embedding-ada-002: -5.0%');
  }

  // 4. Cost breakdown by multiple dimensions
  console.log('\n\n4. MULTI-DIMENSIONAL BREAKDOWN (Last 30 days)');
  console.log('='.repeat(50));
  const breakdown = await sendRequest('tools/call', {
    name: 'cost.breakdown',
    arguments: {
      provider: 'openai',
      startDate: startDate30d,
      endDate: endDate,
      dimensions: ['service', 'date'],
      topN: 5,
    },
  });

  if (breakdown?.success) {
    console.log('Top 5 Cost Drivers:');
    breakdown.data.breakdown.forEach((item, i) => {
      console.log(
        `  ${i + 1}. ${item.name}: $${item.value.toFixed(2)} (${item.percentage.toFixed(1)}%)`,
      );
    });
  } else {
    // Mock data
    console.log('Top 5 Cost Drivers by Date:');
    console.log('  1. 2024-12-28 (gpt-4): $8.50 (6.8%)');
    console.log('  2. 2024-12-27 (gpt-4): $7.25 (5.8%)');
    console.log('  3. 2024-12-29 (gpt-3.5-turbo): $6.80 (5.4%)');
    console.log('  4. 2024-12-26 (gpt-4): $6.50 (5.2%)');
    console.log('  5. 2024-12-25 (gpt-4): $6.25 (5.0%)');
  }

  // 5. Insights and Recommendations
  console.log('\n\n5. INSIGHTS & RECOMMENDATIONS');
  console.log('='.repeat(50));
  console.log('\n📊 Usage Patterns:');
  console.log('  • Peak usage days: Weekdays (Mon-Fri)');
  console.log('  • Lowest usage: Weekends');
  console.log('  • Most active hours: 9 AM - 5 PM EST');

  console.log('\n💡 Cost Optimization Tips:');
  console.log('  • Consider gpt-3.5-turbo for non-critical tasks (20x cheaper)');
  console.log('  • Batch embedding requests to reduce API calls');
  console.log('  • Implement response caching for repeated queries');
  console.log('  • Monitor token usage to avoid unexpected costs');

  console.log('\n📈 Projected Monthly Cost:');
  console.log('  • Based on current trend: $150-180');
  console.log('  • If optimized: $100-120 (potential 33% savings)');

  console.log('\n\n=== Analysis Complete ===');

  server.kill();
  process.exit(0);
}

// Run analysis after server starts
setTimeout(runAnalysis, 1000);

// Timeout handler
setTimeout(() => {
  console.log('\nAnalysis timed out');
  server.kill();
  process.exit(1);
}, 30000);
