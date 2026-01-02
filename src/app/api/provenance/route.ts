import { NextResponse } from "next/server";
import * as fs from "node:fs"; // 1. Use standard synchronous FS

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  let imageDigest = "unknown";

  try {
    const filePath = "/.container-labels.json";

    // 2. Synchronous check & read. 
    // This prevents "Unhandled Promise Rejections" from crashing the build.
    if (fs.existsSync(filePath)) {
      const fileContent = fs.readFileSync(filePath, "utf-8");
      const labels = JSON.parse(fileContent);

      imageDigest =
        labels["org.opencontainers.image.digest"] ??
        labels["org.opencontainers.image.revision"] ??
        "unknown";
    }
  } catch (error) {
    // 3. Silently swallow the error.
    // During `npm run build`, the file is missing, so this block runs.
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