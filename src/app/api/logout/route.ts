import { NextResponse } from "next/server";
import { clearAuthCookie } from "@/lib/security/auth-cookie";
import { removeCsrfToken } from "@/lib/security/csrf";

export async function POST() {
  await clearAuthCookie();
  await removeCsrfToken();
  return NextResponse.json({ ok: true });
}