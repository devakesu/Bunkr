import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    {
      commit: process.env.SOURCE_COMMIT ?? "unknown",
      build_id: process.env.SOURCE_COMMIT ?? "unknown",
      node_env: process.env.NODE_ENV ?? "unknown",
      timestamp: new Date().toISOString(),
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    }
  );
}
