#!/usr/bin/env node
require('dotenv').config();
const { spawn } = require('child_process');
const readline = require('readline');

console.log('Starting MCP Server Test...\n');

// Check environment variables
console.log('Environment Check:');
console.log(
  '  OPENAI_API_KEY:',
  process.env.OPENAI_API_KEY ? `Set (${process.env.OPENAI_API_KEY.length} chars)` : 'Not set',
);
console.log('  AWS_ACCESS_KEY_ID:', process.env.AWS_ACCESS_KEY_ID ? 'Set' : 'Not set');
console.log('  GCP credentials:', process.env.GOOGLE_APPLICATION_CREDENTIALS ? 'Set' : 'Not set');

// Start the MCP server
console.log('\nStarting MCP server...');
const server = spawn('node', ['dist/index.js'], {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: process.env,
});

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Handle server stdout
server.stdout.on('data', (data) => {
  const output = data.toString();
  console.log('Server:', output.trim());

  // Parse JSON-RPC responses
  try {
    const lines = output.split('\n').filter((line) => line.trim());
    for (const line of lines) {
      if (line.includes('{') && line.includes('}')) {
        const json = JSON.parse(line);
        if (json.result) {
          console.log('\nResponse received:', JSON.stringify(json.result, null, 2));
        }
      }
    }
  } catch (e) {
    // Not JSON, ignore
  }
});

// Handle server stderr
server.stderr.on('data', (data) => {
  console.error('Server Error:', data.toString());
});

// Send test commands
async function sendCommand(method, params = {}) {
  const request = {
    jsonrpc: '2.0',
    id: Date.now(),
    method: method,
    params: params,
  };

  console.log('\nSending:', JSON.stringify(request, null, 2));
  server.stdin.write(JSON.stringify(request) + '\n');

  // Wait a bit for response
  await new Promise((resolve) => setTimeout(resolve, 1000));
}

async function runTests() {
  // Wait for server to start
  await new Promise((resolve) => setTimeout(resolve, 2000));

  console.log('\n=== Testing MCP Server ===\n');

  // Test 1: List tools
  console.log('Test 1: Listing available tools');
  await sendCommand('tools/list');

  // Test 2: List providers
  console.log('\nTest 2: Listing configured providers');
  await sendCommand('tools/call', {
    name: 'provider.list',
    arguments: {},
  });

  // Test 3: Get OpenAI costs (if API key is valid)
  if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your_openai_api_key') {
    console.log('\nTest 3: Getting OpenAI costs for last 7 days');
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    await sendCommand('tools/call', {
      name: 'cost.get',
      arguments: {
        provider: 'openai',
        startDate: startDate,
        endDate: endDate,
        granularity: 'daily',
      },
    });
  } else {
    console.log('\nSkipping OpenAI cost test (API key not configured)');
  }

  // Wait a bit more for any final responses
  await new Promise((resolve) => setTimeout(resolve, 2000));

  console.log('\n=== Test Complete ===');
  console.log('\nPress Ctrl+C to exit');
}

// Handle exit
process.on('SIGINT', () => {
  console.log('\nShutting down...');
  server.kill();
  process.exit(0);
});

// Run tests after a short delay
setTimeout(runTests, 1000);
