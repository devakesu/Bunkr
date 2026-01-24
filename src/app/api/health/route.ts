import { NextResponse } from "next/server";
import packageJson from "../../../../package.json";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    version: packageJson.version || "1.0.0",
    timestamp: new Date().toISOString(),
  });
}
