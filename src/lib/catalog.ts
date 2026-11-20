/**
 * Launch catalogue: plans and models.
 *
 * IMPORTANT: providerModelId values and costs below are PLACEHOLDERS.
 * Before going live, check every id and price against the OpenRouter model
 * list and set each multiplier from real cost (see docs/COST-SHEET in README).
 * Once the database is connected this file only seeds the `models` and
 * `plans` tables; the tables then become the source of truth.
 */

export type Tier = "standard" | "premium";

export interface ModelInfo {
  id: string;
  providerModelId: string;
  provider: string;
  displayName: string;
  tier: Tier;
  inputCostPerM: number; // USD per 1M input tokens (placeholder)
  outputCostPerM: number; // USD per 1M output tokens (placeholder)
  multiplier: number; // wallet tokens charged per real token
  contextWindow: number;
  supportsVision: boolean;
  enabled: boolean;
}

export interface PlanInfo {
  id: "free" | "plus" | "pro" | "team";
  name: string;
  priceMonthlyCents: number;
  priceYearlyCents: number | null;
  monthlyTokens: number;
  premiumModels: boolean;
  rolloverMonths: number;
}

export const PLANS: PlanInfo[] = [
  { id: "free", name: "Free", priceMonthlyCents: 0, priceYearlyCents: null, monthlyTokens: 50_000, premiumModels: false, rolloverMonths: 0 },
  { id: "plus", name: "Plus", priceMonthlyCents: 1000, priceYearlyCents: 8400, monthlyTokens: 3_000_000, premiumModels: true, rolloverMonths: 1 },
  { id: "pro", name: "Pro", priceMonthlyCents: 2500, priceYearlyCents: 24000, monthlyTokens: 10_000_000, premiumModels: true, rolloverMonths: 1 },
  { id: "team", name: "Team", priceMonthlyCents: 1500, priceYearlyCents: 15000, monthlyTokens: 4_000_000, premiumModels: true, rolloverMonths: 1 },
];

const m = (
  id: string,
  provider: string,
  displayName: string,
  tier: Tier,
  inputCostPerM: number,
  outputCostPerM: number,
  contextWindow: number,
  supportsVision: boolean,
): ModelInfo => ({
  id,
  providerModelId: `${provider}/${id}`,
  provider,
  displayName,
  tier,
  inputCostPerM,
  outputCostPerM,
  multiplier: tier === "premium" ? 4 : 1,
  contextWindow,
  supportsVision,
  enabled: true,
});

export const MODELS: ModelInfo[] = [
  m("gpt-5.4-mini", "openai", "GPT-5.4 mini", "standard", 0.5, 2, 400_000, true),
  m("gpt-5.5", "openai", "GPT-5.5", "premium", 3, 12, 400_000, true),
  m("claude-haiku-4.5", "anthropic", "Claude Haiku 4.5", "standard", 1, 5, 200_000, true),
  m("claude-sonnet-5", "anthropic", "Claude Sonnet 5", "premium", 3, 15, 200_000, true),
  m("gemini-3-flash", "google", "Gemini 3 Flash", "standard", 0.3, 2.5, 1_000_000, true),
  m("gemini-3.1-pro", "google", "Gemini 3.1 Pro", "premium", 2, 12, 1_000_000, true),
  m("grok-4", "x-ai", "Grok 4", "premium", 3, 15, 256_000, true),
  m("deepseek-chat", "deepseek", "DeepSeek Chat", "standard", 0.3, 1.2, 128_000, false),
  m("mistral-small", "mistralai", "Mistral Small", "standard", 0.2, 0.6, 128_000, false),
  m("qwen-plus", "qwen", "Qwen Plus", "standard", 0.4, 1.2, 128_000, false),
  m("kimi-k2.5", "moonshotai", "Kimi K2.5", "standard", 0.6, 2.5, 256_000, false),
  m("sonar", "perplexity", "Perplexity Sonar", "standard", 1, 1, 128_000, false),
];

export function getModel(id: string): ModelInfo | undefined {
  return MODELS.find((x) => x.id === id && x.enabled);
}

/** Real USD cost of a call, from the registry prices. */
export function costUsd(model: ModelInfo, tokensIn: number, tokensOut: number): number {
  return (tokensIn * model.inputCostPerM + tokensOut * model.outputCostPerM) / 1_000_000;
}

/** Rough token estimate: about 4 characters per token. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
