export interface OpenAIUsageResponse {
  object: string;
  data: OpenAIUsageData[];
  has_more: boolean;
  next_page?: string;
}

export interface OpenAIUsageData {
  organization_id: string;
  organization_name: string;
  aggregation_timestamp: number;
  n_requests: number;
  operation: string;
  snapshot_id: string;
  n_context_tokens_total: number;
  n_generated_tokens_total: number;
  email?: string | null;
  api_key_id?: string | null;
  api_key_name?: string | null;
  api_key_redacted?: string | null;
  api_key_type?: string | null;
  project_id?: string | null;
  project_name?: string | null;
  request_type: string;
  n_cached_context_tokens_total: number;
  n_context_audio_tokens_total: number;
  n_generated_audio_tokens_total: number;
}

export interface OpenAIUsageByModel {
  model: string;
  n_requests: number;
  n_context_tokens: number;
  n_generated_tokens: number;
}

export interface OpenAICostResponse {
  object: string;
  data: OpenAICostData[];
  has_more: boolean;
  next_page?: string;
}

export interface OpenAICostData {
  timestamp: number;
  amount: number;
  currency: string;
  line_items: OpenAICostLineItem[];
}

export interface OpenAICostLineItem {
  name: string;
  cost: number;
  tokens?: number;
}

export interface OpenAIProviderConfig {
  apiKey: string;
}

// Model pricing as of 2025 (per 1K tokens)
export const OPENAI_MODEL_PRICING = {
  // GPT-4o models
  'gpt-4o-2024-08-06': { input: 0.0025, output: 0.01 },
  'gpt-4o-2024-11-20': { input: 0.0025, output: 0.01 },
  'gpt-4o-mini-2024-07-18': { input: 0.00015, output: 0.0006 },

  // GPT-4.1 (latest)
  'gpt-4.1-2025-04-14': { input: 0.03, output: 0.06 },

  // GPT-4 Turbo
  'gpt-4-turbo': { input: 0.01, output: 0.03 },
  'gpt-4-turbo-2024-04-09': { input: 0.01, output: 0.03 },
  'gpt-4-turbo-preview': { input: 0.01, output: 0.03 },

  // GPT-4
  'gpt-4': { input: 0.03, output: 0.06 },
  'gpt-4-0314': { input: 0.03, output: 0.06 },
  'gpt-4-0613': { input: 0.03, output: 0.06 },
  'gpt-4-32k': { input: 0.06, output: 0.12 },

  // GPT-3.5 Turbo
  'gpt-3.5-turbo': { input: 0.0005, output: 0.0015 },
  'gpt-3.5-turbo-16k': { input: 0.001, output: 0.002 },
  'gpt-3.5-turbo-0125': { input: 0.0005, output: 0.0015 },

  // Embeddings
  'text-embedding-ada-002': { input: 0.0001, output: 0 },
  'text-embedding-3-small': { input: 0.00002, output: 0 },
  'text-embedding-3-large': { input: 0.00013, output: 0 },

  // DALL-E
  'dall-e-3': {
    '1024x1024': 0.04,
    '1024x1792': 0.08,
    '1792x1024': 0.08,
  },
  'dall-e-2': {
    '1024x1024': 0.02,
    '512x512': 0.018,
    '256x256': 0.016,
  },
};
