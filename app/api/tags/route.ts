import { NextRequest, NextResponse } from "next/server";
import { arcaneApi } from "@/lib/arcane-api";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const name = searchParams.get("name") || undefined;
    const limit = searchParams.get("limit")
      ? Number(searchParams.get("limit"))
      : undefined;
    const data = await arcaneApi.getTags({ name, limit });
    return NextResponse.json(data);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to fetch tags";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
