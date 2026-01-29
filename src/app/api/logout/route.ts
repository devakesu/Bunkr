import { NextResponse } from "next/server";
import { clearAuthCookie } from "@/lib/security/auth-cookie";
import { clearCsrfToken } from "@/lib/security/csrf";

export async function POST() {
  await clearAuthCookie();
  await clearCsrfToken();
  return NextResponse.json({ ok: true });
}