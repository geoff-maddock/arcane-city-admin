import { NextResponse } from "next/server";
import { arcaneApi } from "@/lib/arcane-api";

export async function GET() {
  try {
    const result = await arcaneApi.testConnection();
    return NextResponse.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Connection test failed";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
