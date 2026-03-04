import { NextRequest, NextResponse } from "next/server";
import { arcaneApi } from "@/lib/arcane-api";

// Note: photo upload uses integer event id (not slug) per the API spec.
// This route accepts the slug but first fetches the event to get the integer id.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const body = await req.json() as {
      name: string;
      dataUrl: string;
      mimeType: string;
    };

    // Fetch event to get integer id
    const event = await arcaneApi.getEvent(slug);
    await arcaneApi.uploadEventPhoto(event.id, body);
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to upload photo";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
