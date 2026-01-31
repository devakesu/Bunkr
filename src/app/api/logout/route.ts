import { NextRequest, NextResponse } from "next/server";
import { clearAuthCookie } from "@/lib/security/auth-cookie";
import { removeCsrfToken, validateCsrfToken } from "@/lib/security/csrf";
import { clearTermsVersionCookie } from "@/app/actions/user";

export async function POST(req: NextRequest) {
  // CSRF protection: Prevent unauthorized logout attacks
  // Without this check, an attacker could log out users by embedding
  // a POST request to this endpoint on a malicious page
  const csrfToken = req.headers.get("x-csrf-token");
  const csrfValid = await validateCsrfToken(csrfToken);
  
  if (!csrfValid) {
    return NextResponse.json(
      { message: "Invalid CSRF token" },
      { status: 403 }
    );
  }

  await clearAuthCookie();
  await removeCsrfToken();
  await clearTermsVersionCookie();
  return NextResponse.json({ ok: true });
}