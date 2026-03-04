import type {
  ExtractedEventData,
  LLMMatchResult,
} from "@/types/llm";
import type {
  EntityResponse,
  Tag,
  EventTypeResponse,
  EventStatusResponse,
  Visibility,
  EventResponse,
} from "@/types/api";

// ─── Vision Extraction ───────────────────────────────────────────────────────

export function buildExtractionSystemPrompt(): string {
  const today = new Date().toISOString().split("T")[0]; // e.g. "2026-03-03"
  return `You are an event data extraction specialist for arcane.city, a music and arts event tracker focused on Pittsburgh PA and surrounding areas.

Your task is to analyze event flyer images and extract structured data. Return ONLY a valid JSON object — no markdown fences, no extra text.

Today's date is ${today}. Use this to infer the correct year when a flyer shows only a month/day.

RESPONSE JSON SCHEMA (use these exact field names):
Required:
- name: string — event name
- date_text: string — exact date/time text copied from the flyer
- start_at_parsed: string — start time as ISO 8601 UTC (e.g. "2026-03-07T02:00:00Z")

Optional:
- end_at_parsed: string — end time as ISO 8601 UTC
- door_at_parsed: string — door open time as ISO 8601 UTC
- short: string, max 255 chars, one-line tagline
- description: string, full description
- venue_name: string, exact venue name from flyer
- promoter_name: string, promoter or organizer name
- presale_price: number (dollars, no $ sign)
- door_price: number
- min_age: integer (0=all ages, 18=18+, 21=21+)
- primary_link: string, URL
- ticket_link: string, ticketing URL
- is_benefit: boolean
- tags_raw: string[], music genres/styles/themes from flyer
- entities_raw: string[], performer and artist names
- event_type_raw: string, type of event
- confidence: object with keys name/dates/venue/prices (0-1 scale)
- notes: string, your caveats or uncertain items

EXTRACTION RULES:
1. Dates: All times are Eastern Time (America/New_York) unless stated otherwise. Convert to UTC for start_at_parsed/end_at_parsed/door_at_parsed. Always pick the nearest future date when the year is not shown.
2. Prices: "10/15" or "$10 adv / $15 dos" = presale_price:10, door_price:15. "Free" = presale_price:0, door_price:0.
3. Age: "21+" or "21 and over" = min_age:21. "18+" = min_age:18. "all ages" or "AA" = min_age:0.
4. Tags: Extract specific genres (e.g. "drum and bass", "jungle", "techno", "noise rock") not vague categories. Include themes like "benefit", "queer".
5. Entities: List all performers, DJs, bands, headliners, and support acts.
6. If uncertain about a field, omit it rather than guess. Use confidence scores.
7. Return ONLY the JSON object.`;
}

export function buildExtractionUserPrompt(additionalContext?: string): string {
  let prompt =
    "Extract all event details from this flyer image and return as JSON matching the schema.";
  if (additionalContext?.trim()) {
    prompt += `\n\nAdditional context from the user:\n${additionalContext.trim()}`;
  }
  return prompt;
}

// ─── Entity/Tag Matching ─────────────────────────────────────────────────────

export function buildMatchingPrompt(params: {
  extracted: ExtractedEventData;
  entities: EntityResponse[];
  tags: Tag[];
  eventTypes: EventTypeResponse[];
  eventStatuses: EventStatusResponse[];
  visibilities: Visibility[];
}): string {
  const { extracted, entities, tags, eventTypes, eventStatuses, visibilities } =
    params;

  return `You are matching extracted event data against a database. Return ONLY a valid JSON object — no markdown.

EXTRACTED DATA:
${JSON.stringify(extracted, null, 2)}

AVAILABLE EVENT TYPES (choose best match for event_type_id):
${eventTypes.map((t) => `${t.id}: ${t.name}${t.short ? ` — ${t.short}` : ""}`).join("\n")}

AVAILABLE EVENT STATUSES (choose event_status_id — use the active/published one):
${eventStatuses.map((s) => `${s.id}: ${s.name}`).join("\n")}

AVAILABLE VISIBILITIES (choose visibility_id — default to Public):
${visibilities.map((v) => `${v.id}: ${v.name}`).join("\n")}

AVAILABLE ENTITIES (match venue_name, promoter_name, and entities_raw):
${entities
  .map(
    (e) =>
      `${e.id}: ${e.name} [type: ${e.entity_type?.name ?? "unknown"}] slug: ${e.slug}`
  )
  .join("\n")}

AVAILABLE TAGS (match tags_raw):
${tags.map((t) => `${t.id}: ${t.name}`).join("\n")}

MATCHING INSTRUCTIONS:
1. venue_id: match venue_name to an entity of type "Venue". Null if no confident match (>70%).
2. promoter_id: match promoter_name to an entity. Null if no confident match.
3. tag_list: match tags_raw items to tag IDs. Include all reasonable matches.
4. entity_list: match entities_raw (performers) to entity IDs. Include all matches.
5. event_type_id: match event_type_raw to the closest event type.
6. event_status_id: choose the active/published status.
7. visibility_id: use the Public visibility.
8. Only include IDs with >70% confidence. Use null for uncertain fields.

RETURN FORMAT (JSON only):
{
  "event_type_id": number,
  "event_status_id": number,
  "visibility_id": number,
  "venue_id": number | null,
  "promoter_id": number | null,
  "tag_list": number[],
  "entity_list": number[],
  "match_notes": string
}`;
}

// ─── Event Enrichment ─────────────────────────────────────────────────────────

export function buildEnrichmentPrompt(params: {
  existingEvent: EventResponse;
  additionalInfo: string;
  availableEntities?: EntityResponse[];
  availableTags?: Tag[];
}): string {
  const { existingEvent, additionalInfo, availableEntities, availableTags } =
    params;

  const entitySection = availableEntities?.length
    ? `\nAVAILABLE ENTITIES:\n${availableEntities.map((e) => `${e.id}: ${e.name}`).join("\n")}`
    : "";

  const tagSection = availableTags?.length
    ? `\nAVAILABLE TAGS:\n${availableTags.map((t) => `${t.id}: ${t.name}`).join("\n")}`
    : "";

  return `You are enriching an existing event record with additional information. Return ONLY a valid JSON object with the fields that should be updated — no markdown, no extra text.

EXISTING EVENT (current values):
${JSON.stringify(existingEvent, null, 2)}

ADDITIONAL INFORMATION:
${additionalInfo}
${entitySection}
${tagSection}

INSTRUCTIONS:
1. Only return fields that should be changed or added based on the additional information.
2. Do not include fields that already have good values unless explicitly changing them.
3. For tag_list and entity_list: return the full updated array (existing IDs + any new ones).
4. Return null for any field that should be cleared.
5. Return ONLY the partial EventRequest JSON object.`;
}

// ─── Prop building helpers for the matching call ─────────────────────────────

// Extract search terms from extracted data to pre-filter entity search
export function extractEntitySearchTerms(
  extracted: ExtractedEventData
): string[] {
  const terms: string[] = [];
  if (extracted.venue_name) terms.push(extracted.venue_name);
  if (extracted.promoter_name) terms.push(extracted.promoter_name);
  if (extracted.entities_raw) terms.push(...extracted.entities_raw.slice(0, 10));
  return terms;
}

// Extract tag search terms from extracted data
export function extractTagSearchTerms(
  extracted: ExtractedEventData
): string[] {
  return extracted.tags_raw?.slice(0, 20) ?? [];
}

// Build the proposed EventRequest from extracted + matched data
export function buildProposedEvent(
  extracted: ExtractedEventData,
  matched: LLMMatchResult
) {
  return {
    name: extracted.name ?? "",
    slug: "", // Will be auto-generated in the form
    start_at: extracted.start_at_parsed ?? "",
    end_at: extracted.end_at_parsed ?? null,
    door_at: extracted.door_at_parsed ?? null,
    short: extracted.short ?? null,
    description: extracted.description ?? null,
    presale_price: extracted.presale_price ?? null,
    door_price: extracted.door_price ?? null,
    min_age: extracted.min_age ?? null,
    primary_link: extracted.primary_link ?? null,
    ticket_link: extracted.ticket_link ?? null,
    is_benefit: extracted.is_benefit ?? false,
    event_type_id: matched.event_type_id ?? 0,
    event_status_id: matched.event_status_id ?? null,
    visibility_id: matched.visibility_id ?? 1,
    venue_id: matched.venue_id ?? null,
    promoter_id: matched.promoter_id ?? null,
    tag_list: matched.tag_list ?? [],
    entity_list: matched.entity_list ?? [],
  };
}
