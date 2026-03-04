import { NextRequest, NextResponse } from "next/server";
import { arcaneApi } from "@/lib/arcane-api";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const event = await arcaneApi.getEvent(slug);
    return NextResponse.json(event);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to fetch event";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const body = await req.json();
    const event = await arcaneApi.updateEvent(slug, body);
    return NextResponse.json(event);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to update event";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
