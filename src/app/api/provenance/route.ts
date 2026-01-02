import { NextResponse } from "next/server";
import fs from "fs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

let containerLabels = null;

if (process.env.NODE_ENV === "production") {
  const labels = JSON.parse(
    fs.readFileSync("/.container-labels.json", "utf8")
  );

  if (labels["org.opencontainers.image.revision"] !== process.env.SOURCE_COMMIT) {
    throw new Error("Provenance mismatch");
  }
}

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
      image_digest: imageDigest ?? null,
      container: Boolean(imageDigest),
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
