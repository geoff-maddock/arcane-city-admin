import { NextResponse } from "next/server";
import { arcaneApi } from "@/lib/arcane-api";

export async function GET() {
  try {
    const data = await arcaneApi.getVisibilities();
    return NextResponse.json(data);
  } catch (err: unknown) {
    const msg =
      err instanceof Error ? err.message : "Failed to fetch visibilities";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
