import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  const commitSha = process.env.APP_COMMIT_SHA ?? "dev";

  return NextResponse.json(
    {
      commit: commitSha,
      build_id: commitSha,
      image_digest: commitSha,
      container: Boolean(commitSha !== "dev"),
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