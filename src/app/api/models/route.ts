import { MODELS } from "@/lib/catalog";

export async function GET() {
  return Response.json(
    MODELS.filter((m) => m.enabled).map(({ id, displayName, provider, tier, multiplier }) => ({
      id,
      displayName,
      provider,
      tier,
      multiplier,
    })),
  );
}
