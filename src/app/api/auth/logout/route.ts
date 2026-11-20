import { cookies } from "next/headers";
import { SESSION_COOKIE, deleteSession } from "@/lib/auth";
import { sameOrigin } from "@/lib/ratelimit";
import { getBase } from "@/lib/server";
import { clearSessionCookie } from "@/lib/session-cookie";

export async function POST(req: Request) {
  if (!sameOrigin(req)) return Response.json({ message: "Request not allowed." }, { status: 403 });
  const { db } = await getBase();
  if (db) await deleteSession(db, (await cookies()).get(SESSION_COOKIE)?.value);
  await clearSessionCookie();
  return Response.json({ ok: true });
}
