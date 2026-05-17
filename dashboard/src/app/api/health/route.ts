import { NextResponse } from "next/server";

export const runtime = "nodejs";

const VERSION = "0.3.0";

export async function GET() {
  return NextResponse.json(
    {
      status: "ok",
      version: VERSION,
      environment: process.env.NODE_ENV ?? "unknown",
      checks: {},
    },
    {
      headers: { "cache-control": "no-store, max-age=0" },
    },
  );
}
