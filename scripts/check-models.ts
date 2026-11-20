/**
 * Compares the launch catalogue with OpenRouter's live model list.
 * Run with:  npm run models:check
 *
 * Prints, for each catalogue model, whether its id exists on OpenRouter and
 * how the live price compares with the placeholder price in catalog.ts.
 * Needs internet access. Written against OpenRouter's public /api/v1/models
 * response shape ({ data: [{ id, pricing: { prompt, completion } }] }, prices
 * in USD per token); it has not been run from the build environment.
 */
import { MODELS } from "../src/lib/catalog";

interface LiveModel {
  id: string;
  pricing?: { prompt?: string; completion?: string };
}

async function main() {
  const res = await fetch("https://openrouter.ai/api/v1/models");
  if (!res.ok) throw new Error(`OpenRouter answered ${res.status}`);
  const live: LiveModel[] = (await res.json()).data ?? [];
  const byId = new Map(live.map((m) => [m.id, m]));
  let problems = 0;

  for (const m of MODELS) {
    const found = byId.get(m.providerModelId);
    if (!found) {
      problems++;
      const family = m.providerModelId.split("/")[0];
      const hints = live.filter((x) => x.id.startsWith(family + "/")).slice(0, 6).map((x) => x.id);
      console.log(`MISSING  ${m.providerModelId}  (${m.displayName})\n         similar: ${hints.join(", ") || "none"}`);
      continue;
    }
    const liveIn = Number(found.pricing?.prompt ?? NaN) * 1_000_000;
    const liveOut = Number(found.pricing?.completion ?? NaN) * 1_000_000;
    const drift = liveIn !== m.inputCostPerM || liveOut !== m.outputCostPerM;
    if (drift) problems++;
    console.log(
      `${drift ? "PRICE   " : "OK      "} ${m.providerModelId}  catalogue $${m.inputCostPerM}/$${m.outputCostPerM}  live $${liveIn.toFixed(2)}/$${liveOut.toFixed(2)} per 1M (in/out)`,
    );
  }
  console.log(problems ? `\n${problems} model(s) need attention in src/lib/catalog.ts` : "\nCatalogue matches OpenRouter.");
  process.exit(problems ? 1 : 0);
}

main().catch((err) => {
  console.error("Could not check models:", err.message);
  process.exit(2);
});
