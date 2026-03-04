import { NextRequest, NextResponse } from "next/server";
import { arcaneApi } from "@/lib/arcane-api";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const name = searchParams.get("name") || undefined;
    const entity_type = searchParams.get("entity_type") || undefined;
    const limit = searchParams.get("limit")
      ? Number(searchParams.get("limit"))
      : undefined;
    const data = await arcaneApi.getEntities({ name, entity_type, limit });
    return NextResponse.json(data);
  } catch (err: unknown) {
    const msg =
      err instanceof Error ? err.message : "Failed to fetch entities";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
