import { NextResponse } from "next/server";

const NEON_AUTH_URL = process.env.NEON_AUTH_URL ?? "";
const NEON_AUTH_ORIGIN = process.env.NEON_AUTH_ORIGIN ?? "";
const NEON_AUTH_EMAIL = process.env.NEON_AUTH_EMAIL ?? "";
const NEON_AUTH_PASSWORD = process.env.NEON_AUTH_PASSWORD ?? "";

export async function GET() {
  if (!NEON_AUTH_URL || !NEON_AUTH_ORIGIN || !NEON_AUTH_EMAIL || !NEON_AUTH_PASSWORD) {
    return NextResponse.json(
      { error: "Neon Auth not configured (NEON_AUTH_* env)" },
      { status: 503 }
    );
  }
  const authBase = NEON_AUTH_URL.replace(/\/$/, "");
  const signInRes = await fetch(`${authBase}/sign-in/email`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: NEON_AUTH_ORIGIN,
    },
    body: JSON.stringify({
      email: NEON_AUTH_EMAIL,
      password: NEON_AUTH_PASSWORD,
      callbackURL: NEON_AUTH_ORIGIN,
    }),
  });
  if (!signInRes.ok) {
    const err = await signInRes.text();
    return NextResponse.json({ error: "Neon Auth sign-in failed", detail: err }, { status: 502 });
  }
  const signInBody = await signInRes.json();
  const sessionToken = signInBody?.token ?? signInBody?.session?.token;
  const cookieHeader =
    typeof sessionToken === "string"
      ? `__Secure-neon-auth.session_token=${encodeURIComponent(sessionToken)}`
      : signInRes.headers.get("set-cookie");
  if (!cookieHeader) {
    return NextResponse.json({ error: "No session token from Neon Auth" }, { status: 502 });
  }
  const sessionRes = await fetch(`${authBase}/get-session`, {
    headers: {
      Origin: NEON_AUTH_ORIGIN,
      Cookie: cookieHeader,
    },
  });
  if (!sessionRes.ok) {
    return NextResponse.json({ error: "Neon Auth get-session failed" }, { status: 502 });
  }
  const jwt = sessionRes.headers.get("set-auth-jwt");
  if (!jwt) {
    return NextResponse.json({ error: "No JWT in Neon Auth response" }, { status: 502 });
  }
  return NextResponse.json({ token: jwt });
}
