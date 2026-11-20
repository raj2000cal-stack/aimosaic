import { connection } from "next/server";
import { createChat, listChats } from "@/lib/chats";
import { getContext } from "@/lib/server";

export async function GET() {
  await connection();
  const ctx = await getContext();
  if (!ctx.db) return Response.json([]);
  return Response.json(await listChats(ctx.db, ctx.userId));
}

export async function POST(req: Request) {
  const ctx = await getContext();
  if (!ctx.db) return Response.json({ error: "Chats are not saved in demo mode" }, { status: 409 });
  const body = (await req.json().catch(() => ({}))) as { title?: unknown };
  const title = typeof body.title === "string" ? body.title : "New chat";
  return Response.json({ id: await createChat(ctx.db, ctx.userId, title) });
}
