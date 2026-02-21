// API Route for CSP violation reports
// POST /api/csp-report
//
// Browsers send violation reports here when a Content-Security-Policy directive is
// violated. Two formats are accepted:
//   - application/csp-report      (legacy report-uri mechanism)
//   - application/reports+json    (modern Reporting API v1, report-to mechanism)
//
// The endpoint logs each report for visibility and always returns 204 No Content
// so the browser does not retry. No authentication is required: reports are sent
// automatically by the browser before any user session exists.

import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const ACCEPTED_CONTENT_TYPES = [
  "application/csp-report",
  "application/reports+json",
];

// Maximum body size to log, to prevent log bloat from oversized reports.
const MAX_REPORT_LOG_LENGTH = 2048;

export async function POST(req: NextRequest) {
  const contentType = req.headers.get("content-type") ?? "";
  const isAccepted = ACCEPTED_CONTENT_TYPES.some((t) => contentType.includes(t));

  if (!isAccepted) {
    return new NextResponse(null, { status: 415 });
  }

  try {
    const text = await req.text();
    const truncated =
      text.length > MAX_REPORT_LOG_LENGTH
        ? `${text.slice(0, MAX_REPORT_LOG_LENGTH)}…[truncated]`
        : text;
    logger.warn("[CSP] Violation report received", { report: truncated });
  } catch {
    // Ignore malformed report bodies silently.
  }

  return new NextResponse(null, { status: 204 });
}
