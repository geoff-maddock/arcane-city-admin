import { NextRequest, NextResponse } from "next/server";
import { matchExtractedData } from "@/lib/claude";
import { arcaneApi } from "@/lib/arcane-api";
import {
  extractEntitySearchTerms,
  extractTagSearchTerms,
  buildProposedEvent,
} from "@/lib/prompts";
import type { ExtractedEventData, MatchResponse } from "@/types/llm";

// POST JSON: { extracted: ExtractedEventData }
// Fetches reference data from API, then has Claude match IDs
export async function POST(req: NextRequest) {
  try {
    const { extracted } = (await req.json()) as { extracted: ExtractedEventData };

    if (!extracted) {
      return NextResponse.json(
        { success: false, error: "No extracted data provided" },
        { status: 400 }
      );
    }

    // Fetch all small lookup lists in parallel
    const [eventTypesRes, eventStatusesRes, visibilitiesRes] = await Promise.all([
      arcaneApi.getEventTypes(),
      arcaneApi.getEventStatuses(),
      arcaneApi.getVisibilities(),
    ]);

    const eventTypes = eventTypesRes.data;
    const eventStatuses = eventStatusesRes.data;
    const visibilities = visibilitiesRes.data;

    // Smart entity fetching: search by hints from extracted data
    const entityTerms = extractEntitySearchTerms(extracted);
    const tagTerms = extractTagSearchTerms(extracted);

    // Fetch entities: run searches for each term and deduplicate
    const entityPromises = entityTerms.slice(0, 5).map((term) =>
      arcaneApi.getEntities({ name: term, limit: 10 })
    );
    // Also fetch a broader set
    entityPromises.push(arcaneApi.getEntities({ limit: 50 }));

    const [tagResults, ...entityResults] = await Promise.all([
      tagTerms.length > 0
        ? arcaneApi.getTags({ limit: 100 })
        : Promise.resolve({ data: [] }),
      ...entityPromises,
    ]);

    // Deduplicate entities by id
    const entityMap = new Map();
    for (const res of entityResults) {
      for (const e of res.data) {
        entityMap.set(e.id, e);
      }
    }
    const entities = Array.from(entityMap.values());

    // Filter tags by search terms if we have them
    let tags = tagResults.data;
    if (tagTerms.length > 0 && tags.length === 0) {
      // Fallback: fetch all tags
      const allTags = await arcaneApi.getTags({ limit: 200 });
      tags = allTags.data;
    }

    // Run matching
    const matchResult = await matchExtractedData({
      extracted,
      entities,
      tags,
      eventTypes,
      eventStatuses,
      visibilities,
    });

    const proposedEvent = buildProposedEvent(extracted, matchResult);

    const response: MatchResponse = {
      success: true,
      matched: {
        extracted,
        matched: matchResult,
        proposedEvent,
      },
    };
    return NextResponse.json(response);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Matching failed";
    console.error("[match]", err);
    const response: MatchResponse = { success: false, error: msg };
    return NextResponse.json(response, { status: 500 });
  }
}
