import { NextRequest, NextResponse } from "next/server";
import { enrichEvent } from "@/lib/claude";
import { arcaneApi } from "@/lib/arcane-api";
import type { EnrichmentResponse } from "@/types/llm";

// POST JSON: { slug: string, additionalInfo: string, imageBase64?: string, mimeType?: string }
export async function POST(req: NextRequest) {
  try {
    const { slug, additionalInfo } = (await req.json()) as {
      slug: string;
      additionalInfo: string;
    };

    if (!slug || !additionalInfo) {
      return NextResponse.json(
        { success: false, error: "slug and additionalInfo are required" },
        { status: 400 }
      );
    }

    // Fetch the existing event and reference data in parallel
    const [existingEvent, entitiesRes, tagsRes] = await Promise.all([
      arcaneApi.getEvent(slug),
      arcaneApi.getEntities({ limit: 50 }),
      arcaneApi.getTags({ limit: 100 }),
    ]);

    const updates = await enrichEvent({
      existingEvent,
      additionalInfo,
      availableEntities: entitiesRes.data,
      availableTags: tagsRes.data,
    });

    const response: EnrichmentResponse = {
      success: true,
      updates,
      notes: "Review the proposed updates before applying.",
    };
    return NextResponse.json(response);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Enrichment failed";
    console.error("[enrich]", err);
    const response: EnrichmentResponse = { success: false, error: msg };
    return NextResponse.json(response, { status: 500 });
  }
}
