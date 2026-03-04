import type { EventRequest } from "./api";

// What Claude extracts from a flyer image
export interface ExtractedEventData {
  name?: string;
  date_text?: string; // Raw text e.g. "Friday March 7th, 9pm"
  start_at_parsed?: string | null; // ISO 8601 UTC if parseable
  end_at_parsed?: string | null;
  door_at_parsed?: string | null;
  venue_name?: string; // Raw venue name for matching
  promoter_name?: string; // Raw promoter name for matching
  short?: string;
  description?: string;
  presale_price?: number | null;
  door_price?: number | null;
  min_age?: number | null;
  primary_link?: string | null;
  ticket_link?: string | null;
  is_benefit?: boolean;
  tags_raw?: string[]; // Genre/theme text from flyer
  entities_raw?: string[]; // Performer/artist names
  event_type_raw?: string;
  confidence?: {
    name?: number; // 0-1
    dates?: number;
    venue?: number;
    prices?: number;
  };
  notes?: string; // Claude's caveats or observations
}

// Claude's entity/tag matching result
export interface LLMMatchResult {
  event_type_id?: number | null;
  event_status_id?: number | null;
  visibility_id?: number | null;
  venue_id?: number | null;
  promoter_id?: number | null;
  tag_list?: number[];
  entity_list?: number[];
  match_notes?: string;
}

// Combined: extracted + matched, ready for EventForm pre-population
export interface MatchedEventData {
  extracted: ExtractedEventData;
  matched: LLMMatchResult;
  // Pre-built partial EventRequest for the form
  proposedEvent: Partial<EventRequest>;
}

export interface AnalysisResponse {
  success: boolean;
  extracted?: ExtractedEventData;
  error?: string;
}

export interface MatchResponse {
  success: boolean;
  matched?: MatchedEventData;
  error?: string;
}

// For enrichment (adding info to existing event)
export interface EnrichmentResponse {
  success: boolean;
  updates?: Partial<EventRequest>;
  notes?: string;
  error?: string;
}
