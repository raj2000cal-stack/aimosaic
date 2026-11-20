import { deleteChat, getChatMessages, ownsChat } from "@/lib/chats";
import { getContext } from "@/lib/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function authorise(id: string) {
  const ctx = await getContext();
  if (!ctx.db || !UUID.test(id) || !(await ownsChat(ctx.db, ctx.userId, id))) return null;
  return ctx.db;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await authorise(id);
  if (!db) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(await getChatMessages(db, id));
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await authorise(id);
  if (!db) return Response.json({ error: "Not found" }, { status: 404 });
  await deleteChat(db, id);
  return Response.json({ ok: true });
}
