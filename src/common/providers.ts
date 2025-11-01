export const SUPPORTED_PROVIDERS = ['aws', 'openai', 'anthropic'] as const;

export type SupportedProvider = (typeof SUPPORTED_PROVIDERS)[number];
