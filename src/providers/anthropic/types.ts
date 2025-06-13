export interface AnthropicProviderConfig {
  apiKey: string;
}

export interface AnthropicUsageData {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
}

// Anthropic model pricing as of 2024
export const ANTHROPIC_MODEL_PRICING = {
  // Claude 3 Opus
  'claude-3-opus-20240229': { input: 0.015, output: 0.075 },
  
  // Claude 3 Sonnet
  'claude-3-sonnet-20240229': { input: 0.003, output: 0.015 },
  
  // Claude 3 Haiku
  'claude-3-haiku-20240307': { input: 0.00025, output: 0.00125 },
  
  // Claude 2.1
  'claude-2.1': { input: 0.008, output: 0.024 },
  
  // Claude 2
  'claude-2': { input: 0.008, output: 0.024 },
  
  // Claude Instant
  'claude-instant-1.2': { input: 0.00163, output: 0.00551 },
};