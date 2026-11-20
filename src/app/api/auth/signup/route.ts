import {
  createAccount,
  createSession,
  inviteCodeAccepted,
  normaliseEmail,
  signupPlan,
  validateCredentials,
} from "@/lib/auth";
import { LIMITS, allow, clientIp, sameOrigin } from "@/lib/ratelimit";
import { getBase } from "@/lib/server";
import { setSessionCookie } from "@/lib/session-cookie";

export async function POST(req: Request) {
  const { db } = await getBase();
  if (!db) return Response.json({ message: "Sign-up is not available in demo mode." }, { status: 409 });
  if (!sameOrigin(req)) return Response.json({ message: "Request not allowed." }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const email = typeof body.email === "string" ? normaliseEmail(body.email) : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!(await allow(db, `signup:${clientIp(req)}`, LIMITS.signup))) {
    return Response.json({ message: "Too many sign-ups from this network. Try again later." }, { status: 429 });
  }
  if (!inviteCodeAccepted(body.inviteCode)) {
    return Response.json({ message: "That invite code is not valid." }, { status: 403 });
  }
  const problem = validateCredentials(email, password);
  if (problem) return Response.json({ message: problem }, { status: 400 });

  const userId = await createAccount(db, { email, password, plan: signupPlan() });
  if (!userId) {
    return Response.json({ message: "An account with that email already exists. Sign in instead." }, { status: 409 });
  }
  const session = await createSession(db, userId);
  await setSessionCookie(session.token, session.expiresAt);
  return Response.json({ ok: true });
}
