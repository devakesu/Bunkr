import { NextResponse } from "next/server";
import { clearAuthCookie } from "@/lib/security/auth-cookie";
import { removeCsrfToken } from "@/lib/security/csrf";
import { clearTermsVersionCookie } from "@/app/actions/user";

export async function POST() {
  await clearAuthCookie();
  await removeCsrfToken();
  await clearTermsVersionCookie();
  return NextResponse.json({ ok: true });
}