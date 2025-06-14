#!/usr/bin/env node
// Interactive cost analysis demonstration

console.log('=== OpenAI Cost Analysis - Interactive Demo ===\n');

// Simulated data for demonstration
const mockData = {
  models: {
    'gpt-4': { cost: 98.5, tokens: 2450500, requests: 1250 },
    'gpt-3.5-turbo': { cost: 24.95, tokens: 12475000, requests: 8500 },
    'text-embedding-ada-002': { cost: 2.0, tokens: 10000000, requests: 5000 },
  },
  dailyData: [
    { date: '2025-06-08', cost: 3.2, requests: 145 },
    { date: '2025-06-09', cost: 4.85, requests: 220 },
    { date: '2025-06-10', cost: 5.1, requests: 235 },
    { date: '2025-06-11', cost: 4.75, requests: 215 },
    { date: '2025-06-12', cost: 3.9, requests: 180 },
    { date: '2025-06-13', cost: 6.25, requests: 285 },
    { date: '2025-06-14', cost: 7.7, requests: 350 },
  ],
};

// Analysis functions
function analyzeModelEfficiency() {
  console.log('📊 MODEL EFFICIENCY ANALYSIS');
  console.log('='.repeat(60));

  const models = Object.entries(mockData.models);
  const totalCost = models.reduce((sum, [_, data]) => sum + data.cost, 0);
  const totalTokens = models.reduce((sum, [_, data]) => sum + data.tokens, 0);

  console.log(`\nTotal Cost: $${totalCost.toFixed(2)}`);
  console.log(`Total Tokens: ${(totalTokens / 1000000).toFixed(1)}M`);
  console.log(`Average Cost per 1M tokens: $${(totalCost / (totalTokens / 1000000)).toFixed(2)}`);

  console.log('\nModel Efficiency Ranking:');
  const efficiency = models
    .map(([model, data]) => ({
      model,
      costPer1M: data.cost / (data.tokens / 1000000),
      tokensPerDollar: Math.round(data.tokens / data.cost),
    }))
    .sort((a, b) => a.costPer1M - b.costPer1M);

  efficiency.forEach((item, idx) => {
    const bar = '█'.repeat(Math.round(item.tokensPerDollar / 10000));
    console.log(
      `${idx + 1}. ${item.model.padEnd(25)} $${item.costPer1M.toFixed(2)}/1M tokens ${bar}`,
    );
  });
}

function analyzeCostDistribution() {
  console.log('\n\n💰 COST DISTRIBUTION ANALYSIS');
  console.log('='.repeat(60));

  const models = Object.entries(mockData.models);
  const totalCost = models.reduce((sum, [_, data]) => sum + data.cost, 0);

  console.log('\nCost Breakdown by Model:');
  models
    .sort((a, b) => b[1].cost - a[1].cost)
    .forEach(([model, data]) => {
      const percentage = (data.cost / totalCost) * 100;
      const bar = '█'.repeat(Math.round(percentage / 2));
      console.log(
        `${model.padEnd(25)} $${data.cost.toFixed(2).padStart(7)} (${percentage.toFixed(1).padStart(4)}%) ${bar}`,
      );
    });

  // Pareto analysis
  console.log('\nPareto Analysis:');
  let cumulativeCost = 0;
  let modelsFor80Percent = 0;
  for (const [model, data] of models.sort((a, b) => b[1].cost - a[1].cost)) {
    cumulativeCost += data.cost;
    modelsFor80Percent++;
    if (cumulativeCost / totalCost >= 0.8) {
      console.log(`→ ${modelsFor80Percent} model(s) account for 80% of costs`);
      break;
    }
  }
}

function analyzeUsagePatterns() {
  console.log('\n\n📈 USAGE PATTERN ANALYSIS');
  console.log('='.repeat(60));

  const days = mockData.dailyData;
  const avgCost = days.reduce((sum, day) => sum + day.cost, 0) / days.length;
  const avgRequests = days.reduce((sum, day) => sum + day.requests, 0) / days.length;

  console.log(`\nAverage Daily Cost: $${avgCost.toFixed(2)}`);
  console.log(`Average Daily Requests: ${Math.round(avgRequests)}`);
  console.log(`Average Cost per Request: $${(avgCost / avgRequests).toFixed(4)}`);

  console.log('\nDaily Trend Visualization:');
  const maxCost = Math.max(...days.map((d) => d.cost));
  days.forEach((day) => {
    const barLength = Math.round((day.cost / maxCost) * 40);
    const bar = '█'.repeat(barLength);
    const date = new Date(day.date).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
    console.log(`${date.padEnd(12)} $${day.cost.toFixed(2).padStart(5)} ${bar}`);
  });

  // Identify patterns
  const weekdayAvg =
    days
      .filter((d) => {
        const dayOfWeek = new Date(d.date).getDay();
        return dayOfWeek >= 1 && dayOfWeek <= 5;
      })
      .reduce((sum, d) => sum + d.cost, 0) / 5;

  const weekendAvg =
    days
      .filter((d) => {
        const dayOfWeek = new Date(d.date).getDay();
        return dayOfWeek === 0 || dayOfWeek === 6;
      })
      .reduce((sum, d) => sum + d.cost, 0) / 2;

  console.log(`\nWeekday Average: $${weekdayAvg.toFixed(2)}`);
  console.log(`Weekend Average: $${weekendAvg.toFixed(2)}`);
  console.log(`Weekend vs Weekday: ${((weekendAvg / weekdayAvg - 1) * 100).toFixed(1)}%`);
}

function generateOptimizationScenarios() {
  console.log('\n\n🎯 OPTIMIZATION SCENARIOS');
  console.log('='.repeat(60));

  const currentMonthly = 125.45;

  const scenarios = [
    {
      name: 'Conservative',
      description: 'Switch 30% of GPT-4 to GPT-3.5',
      savings: 0.25,
      effort: 'Low',
    },
    {
      name: 'Moderate',
      description: 'Implement caching + model optimization',
      savings: 0.35,
      effort: 'Medium',
    },
    {
      name: 'Aggressive',
      description: 'Full optimization + fine-tuning',
      savings: 0.5,
      effort: 'High',
    },
  ];

  console.log('\nCurrent Monthly Cost: $' + currentMonthly.toFixed(2));
  console.log('\nOptimization Scenarios:');

  scenarios.forEach((scenario, idx) => {
    const newCost = currentMonthly * (1 - scenario.savings);
    const monthlySavings = currentMonthly - newCost;
    const annualSavings = monthlySavings * 12;

    console.log(`\n${idx + 1}. ${scenario.name} Approach`);
    console.log(`   Strategy: ${scenario.description}`);
    console.log(`   Implementation Effort: ${scenario.effort}`);
    console.log(`   New Monthly Cost: $${newCost.toFixed(2)}`);
    console.log(
      `   Monthly Savings: $${monthlySavings.toFixed(2)} (${(scenario.savings * 100).toFixed(0)}%)`,
    );
    console.log(`   Annual Savings: $${annualSavings.toFixed(2)}`);

    // Visual representation
    const savingsBar = '█'.repeat(Math.round(scenario.savings * 20));
    const remainingBar = '░'.repeat(20 - Math.round(scenario.savings * 20));
    console.log(`   Savings: [${savingsBar}${remainingBar}]`);
  });
}

function generateActionableInsights() {
  console.log('\n\n💡 ACTIONABLE INSIGHTS');
  console.log('='.repeat(60));

  const insights = [
    {
      priority: 'HIGH',
      insight: 'GPT-4 usage is 78.5% of costs but only needed for 30% of tasks',
      action: 'Implement model selection logic based on task complexity',
      impact: '$30-40/month savings',
    },
    {
      priority: 'HIGH',
      insight: 'Peak usage on Thu/Fri suggests batch processing opportunity',
      action: 'Queue non-urgent requests for off-peak processing',
      impact: '15% cost reduction',
    },
    {
      priority: 'MEDIUM',
      insight: 'Embedding requests show high volume but low cost',
      action: 'Batch embed requests to reduce API calls',
      impact: 'Improved performance, minimal cost impact',
    },
    {
      priority: 'MEDIUM',
      insight: 'Token efficiency varies significantly by request type',
      action: 'Optimize prompts and implement response streaming',
      impact: '20% token reduction',
    },
    {
      priority: 'LOW',
      insight: 'Weekend usage is 40% lower than weekdays',
      action: 'Schedule maintenance and updates on weekends',
      impact: 'Operational efficiency',
    },
  ];

  insights.forEach((item, idx) => {
    console.log(`\n${idx + 1}. [${item.priority}] ${item.insight}`);
    console.log(`   → Action: ${item.action}`);
    console.log(`   → Expected Impact: ${item.impact}`);
  });
}

// Run all analyses
console.log('Running comprehensive cost analysis...\n');

analyzeModelEfficiency();
analyzeCostDistribution();
analyzeUsagePatterns();
generateOptimizationScenarios();
generateActionableInsights();

console.log('\n\n=== Analysis Complete ===');
console.log('\nThis analysis demonstrates the various perspectives available through');
console.log('the Cost Management MCP server. With real data, you can:');
console.log('• Track costs in real-time');
console.log('• Identify optimization opportunities');
console.log('• Monitor usage trends');
console.log('• Make data-driven decisions');
console.log('\nTo use with your actual OpenAI data, configure the MCP server with');
console.log('your API key and run the analysis tools.');
