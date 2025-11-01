export interface AnthropicCostResponse {
  object: string;
  data: AnthropicCostBucket[];
  has_more: boolean;
  next_page?: string;
}

export interface AnthropicCostBucket {
  bucket_start_time: string; // ISO 8601 timestamp
  bucket_end_time: string; // ISO 8601 timestamp
  costs: AnthropicCost[];
}

export interface AnthropicCost {
  workspace_id?: string;
  workspace_name?: string;
  description?: string;
  cost_usd: string; // Decimal string in cents (e.g., "123.45" for $1.2345)
}

export interface AnthropicUsageResponse {
  object: string;
  data: AnthropicUsageBucket[];
  has_more: boolean;
  next_page?: string;
}

export interface AnthropicUsageBucket {
  bucket_start_time: string; // ISO 8601 timestamp
  bucket_end_time: string; // ISO 8601 timestamp
  usage: AnthropicUsage[];
}

export interface AnthropicUsage {
  workspace_id?: string;
  workspace_name?: string;
  model?: string;
  service_tier?: string;
  context_window?: number;

  // Token counts
  input_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
  output_tokens?: number;

  // Server tool usage
  server_tool_usage?: AnthropicServerToolUsage[];
}

export interface AnthropicServerToolUsage {
  tool_name: string;
  count: number;
}

export interface AnthropicProviderConfig {
  apiKey: string; // Admin API key (sk-ant-admin...)
}

// Model pricing as of January 2025 (per 1M tokens)
export const ANTHROPIC_MODEL_PRICING = {
  // Claude 3.5 Sonnet
  'claude-3-5-sonnet-20241022': { input: 3.0, output: 15.0 },
  'claude-3-5-sonnet-20240620': { input: 3.0, output: 15.0 },

  // Claude 3.5 Haiku
  'claude-3-5-haiku-20241022': { input: 1.0, output: 5.0 },

  // Claude 3 Opus
  'claude-3-opus-20240229': { input: 15.0, output: 75.0 },

  // Claude 3 Sonnet
  'claude-3-sonnet-20240229': { input: 3.0, output: 15.0 },

  // Claude 3 Haiku
  'claude-3-haiku-20240307': { input: 0.25, output: 1.25 },

  // Legacy models
  'claude-2.1': { input: 8.0, output: 24.0 },
  'claude-2.0': { input: 8.0, output: 24.0 },
  'claude-instant-1.2': { input: 0.8, output: 2.4 },
};

// Prompt caching pricing (additional costs)
export const ANTHROPIC_CACHE_PRICING = {
  // Cache write (per 1M tokens)
  write: 3.75,
  // Cache read (per 1M tokens) - 90% discount
  read: 0.3,
};
