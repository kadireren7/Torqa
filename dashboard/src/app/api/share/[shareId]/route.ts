import { NextResponse } from "next/server";
import { fetchSharedScanByShareId } from "@/lib/share-scan";

export const runtime = "nodejs";

export async function GET(_request: Request, ctx: { params: Promise<{ shareId: string }> }) {
  const { shareId } = await ctx.params;
  const payload = await fetchSharedScanByShareId(shareId);
  if (!payload) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(payload);
}
