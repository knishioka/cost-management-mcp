#!/usr/bin/env node
const { spawn } = require('child_process');

console.log('Testing MCP Server OpenAI Cost Retrieval...\n');

// Start the MCP server
const server = spawn('node', ['dist/index.js'], {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: {
    ...process.env,
    // Set a test API key - in real usage this would be set by the MCP client
    OPENAI_API_KEY: process.env.OPENAI_API_KEY || 'sk-test-key-replace-with-real-key',
  },
});

// Handle server output
let outputBuffer = '';
server.stdout.on('data', (data) => {
  const output = data.toString();
  outputBuffer += output;

  // Parse JSON-RPC responses
  const lines = output.split('\n').filter((line) => line.trim());
  for (const line of lines) {
    try {
      const json = JSON.parse(line);
      if (json.level) {
        console.log(`[${json.level}] ${json.message}`);
      }
    } catch (e) {
      // Not JSON, ignore
    }
  }
});

server.stderr.on('data', (data) => {
  console.error('Server Error:', data.toString());
});

// Send test command after server starts
setTimeout(async () => {
  console.log('\n=== Sending OpenAI Cost Request ===\n');

  // Calculate date range (last 7 days)
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 7);

  const request = {
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/call',
    params: {
      name: 'openai.costs',
      arguments: {
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        groupByModel: true,
        includeTokenUsage: true,
      },
    },
  };

  console.log('Request:', JSON.stringify(request, null, 2));
  server.stdin.write(JSON.stringify(request) + '\n');

  // Wait for response
  await new Promise((resolve) => setTimeout(resolve, 3000));

  // Parse response from output buffer
  const responseLines = outputBuffer.split('\n');
  for (const line of responseLines) {
    if (line.includes('"id":1') && line.includes('result')) {
      try {
        const response = JSON.parse(line);
        console.log('\n=== Response Received ===\n');

        if (response.result && response.result.content) {
          const content = response.result.content[0];
          if (content.type === 'text') {
            const data = JSON.parse(content.text);

            if (data.success) {
              console.log('✅ Success!\n');
              console.log('Provider:', data.data.provider);
              console.log('Period:', `${data.data.period.start} to ${data.data.period.end}`);
              console.log('Total Cost:', `$${data.data.costs.total} ${data.data.costs.currency}`);
              console.log('Models:', data.data.models?.length || 0);

              if (data.data.models && data.data.models.length > 0) {
                console.log('\nModel Breakdown:');
                data.data.models.forEach((model) => {
                  console.log(`  - ${model.model}: $${model.cost.toFixed(4)}`);
                  if (model.usage) {
                    console.log(
                      `    Tokens: ${model.usage.totalTokens} (${model.usage.promptTokens} prompt, ${model.usage.completionTokens} completion)`,
                    );
                  }
                });
              }

              if (data.data.dailyUsage && data.data.dailyUsage.length > 0) {
                console.log('\nDaily Usage (last 3 days):');
                data.data.dailyUsage.slice(-3).forEach((day) => {
                  console.log(`  - ${day.date}: $${day.cost.toFixed(4)}`);
                });
              }
            } else {
              console.log('❌ Error:', data.error?.message || 'Unknown error');
              if (data.error?.details) {
                console.log('Details:', data.error.details);
              }
            }
          }
        }
      } catch (e) {
        // Ignore parse errors
      }
    }
  }

  console.log('\n=== Test Complete ===');
  server.kill();
  process.exit(0);
}, 2000);

// Handle timeout
setTimeout(() => {
  console.log('\n❌ Test timed out');
  server.kill();
  process.exit(1);
}, 10000);
