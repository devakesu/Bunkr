import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  // Directly access the environment variable injected by Docker
  const commitSha = process.env.SOURCE_COMMIT ?? "unknown";

  return NextResponse.json(
    {
      commit: process.env.commitSha ?? "dev",
      build_id: process.env.commitSha ?? null,
      image_digest: commitSha ?? null,
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