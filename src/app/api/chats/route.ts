import { connection } from "next/server";
import { createChat, listChats } from "@/lib/chats";
import { sameOrigin } from "@/lib/ratelimit";
import { getContext, unauthorised } from "@/lib/server";

export async function GET() {
  await connection();
  const ctx = await getContext();
  if (!ctx) return unauthorised();
  if (!ctx.db) return Response.json([]);
  return Response.json(await listChats(ctx.db, ctx.userId));
}

export async function POST(req: Request) {
  if (!sameOrigin(req)) return Response.json({ error: "Request not allowed" }, { status: 403 });
  const ctx = await getContext();
  if (!ctx) return unauthorised();
  if (!ctx.db) return Response.json({ error: "Chats are not saved in demo mode" }, { status: 409 });
  const body = (await req.json().catch(() => ({}))) as { title?: unknown };
  const title = typeof body.title === "string" ? body.title : "New chat";
  return Response.json({ id: await createChat(ctx.db, ctx.userId, title) });
}
