import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  let imageDigest = "unknown";

  try {
    const fs = await import("fs");
    
    if (fs.existsSync("/.container-labels.json")) {
      const labels = JSON.parse(
        fs.readFileSync("/.container-labels.json", "utf-8")
      );

      imageDigest =
        labels["org.opencontainers.image.digest"] ??
        labels["org.opencontainers.image.revision"] ??
        "unknown";
    }
  } catch {
    imageDigest = "unavailable";
  }

  return NextResponse.json(
    {
      commit: process.env.SOURCE_COMMIT ?? "dev",
      build_id: process.env.SOURCE_COMMIT ?? null,
      image_digest: process.env.IMAGE_DIGEST ?? null,
      container: Boolean(process.env.IMAGE_DIGEST ?? null),
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
