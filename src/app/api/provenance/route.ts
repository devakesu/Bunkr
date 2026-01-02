import { NextResponse } from "next/server";
import fs from "node:fs/promises"; // 1. Use top-level import with promises

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
    // 2. Attempt to read directly asynchronously.
    // If the file is missing (during build), it triggers the catch block immediately.
    const fileContent = await fs.readFile("/.container-labels.json", "utf-8");
    
    const labels = JSON.parse(fileContent);

    imageDigest =
      labels["org.opencontainers.image.digest"] ??
      labels["org.opencontainers.image.revision"] ??
      "unknown";
      
  } catch (e) {
    // 3. Gracefully handle the error (expected during build time)
    imageDigest = "unavailable";
  }

  return NextResponse.json(
    {
      commit: process.env.SOURCE_COMMIT ?? "dev",
      build_id: process.env.SOURCE_COMMIT ?? null,
      image_digest: imageDigest ?? null,
      container: Boolean(imageDigest !== "unavailable" && imageDigest !== "unknown"),
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