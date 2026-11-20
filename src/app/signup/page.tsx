import { Suspense } from "react";
import { connection } from "next/server";
import AuthForm from "@/components/AuthForm";

export const metadata = { title: "Create your AIMosaic account" };

/** Reads the invite setting at request time, so it can change without a rebuild. */
async function SignupForm() {
  await connection();
  return <AuthForm mode="signup" inviteRequired={Boolean(process.env.BETA_INVITE_CODE)} />;
}

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupForm />
    </Suspense>
  );
}
