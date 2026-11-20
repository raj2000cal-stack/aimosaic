import { checkLogin, createSession, normaliseEmail } from "@/lib/auth";
import { LIMITS, allow, clientIp, sameOrigin } from "@/lib/ratelimit";
import { getBase } from "@/lib/server";
import { setSessionCookie } from "@/lib/session-cookie";

export async function POST(req: Request) {
  const { db } = await getBase();
  if (!db) return Response.json({ message: "Sign-in is not available in demo mode." }, { status: 409 });
  if (!sameOrigin(req)) return Response.json({ message: "Request not allowed." }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const email = typeof body.email === "string" ? normaliseEmail(body.email) : "";
  const password = typeof body.password === "string" ? body.password.slice(0, 200) : "";

  if (!(await allow(db, `login:${clientIp(req)}:${email.slice(0, 254)}`, LIMITS.login))) {
    return Response.json({ message: "Too many attempts. Wait 15 minutes and try again." }, { status: 429 });
  }
  const userId = email && password ? await checkLogin(db, email, password) : null;
  if (!userId) return Response.json({ message: "Email or password is incorrect." }, { status: 401 });

  const session = await createSession(db, userId);
  await setSessionCookie(session.token, session.expiresAt);
  return Response.json({ ok: true });
}
