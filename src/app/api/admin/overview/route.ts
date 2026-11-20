import { connection } from "next/server";
import { overview } from "@/lib/admin";
import { getContext } from "@/lib/server";

export async function GET() {
  await connection();
  const ctx = await getContext();
  // Non-admins get the same 404 as a missing page, so the console is not discoverable.
  if (!ctx || !ctx.isAdmin || !ctx.db) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(await overview(ctx.db));
}
