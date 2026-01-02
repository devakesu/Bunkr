import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  const commitSha = process.env.SOURCE_COMMIT ?? "unknown";

  return NextResponse.json(
    {
      // FIX: Use the variable 'commitSha', not 'process.env.commitSha'
      commit: commitSha,
      build_id: commitSha,
      image_digest: commitSha,
      container: Boolean(commitSha !== "unknown"),
      node_env: process.env.NODE_ENV,
      timestamp: new Date().toISOString(),
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    }
  );
}