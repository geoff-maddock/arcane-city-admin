// Arcane City API types derived from Context/APIs/event-tracker-api.yml

export interface EventRequest {
  name: string;
  slug: string;
  start_at: string; // ISO 8601 UTC
  event_type_id: number;
  visibility_id: number;
  // Optional
  short?: string | null;
  description?: string | null;
  event_status_id?: number | null;
  venue_id?: number | null;
  promoter_id?: number | null;
  series_id?: number | null;
  door_at?: string | null;
  end_at?: string | null;
  presale_price?: number | null;
  door_price?: number | null;
  min_age?: number | null;
  primary_link?: string | null;
  ticket_link?: string | null;
  is_benefit?: boolean;
  do_not_repost?: boolean;
  tag_list?: number[];
  entity_list?: number[];
}

export interface EventResponse {
  id: number;
  name: string;
  slug: string;
  short?: string | null;
  description?: string | null;
  start_at: string;
  end_at?: string | null;
  door_at?: string | null;
  soundcheck_at?: string | null;
  presale_price?: number | null;
  door_price?: number | null;
  min_age?: number | null;
  primary_link?: string | null;
  ticket_link?: string | null;
  is_benefit?: boolean;
  do_not_repost?: boolean;
  cancelled_at?: string | null;
  created_at: string;
  updated_at: string;
  event_type_id?: number | null;
  event_status_id?: number | null;
  venue_id?: number | null;
  promoter_id?: number | null;
  series_id?: number | null;
  visibility_id?: number;
  event_type?: EventTypeResponse;
  event_status?: EventStatusResponse;
  venue?: EntityResponse;
  promoter?: EntityResponse;
  series?: SeriesResponse;
  visibility?: Visibility;
  tags?: Tag[];
  entities?: EntityResponse[];
  primary_photo?: string | null;
  attending_count?: number;
}

export interface EntityResponse {
  id: number;
  name: string;
  slug: string;
  short?: string | null;
  description?: string | null;
  entity_type_id?: number | null;
  entity_status_id?: number | null;
  entity_type?: EntityTypeResponse;
  entity_status?: EntityStatusResponse;
  tags?: Tag[];
  primary_photo?: string | null;
}

export interface EntityTypeResponse {
  id: number;
  name: string;
  slug: string;
  short?: string | null;
}

export interface EntityStatusResponse {
  id: number;
  name: string;
}

export interface Tag {
  id: number;
  name: string;
  slug: string;
  tag_type_id?: number | null;
  description?: string | null;
}

export interface TagType {
  id: number;
  name: string;
  slug: string;
}

export interface EventTypeResponse {
  id: number;
  name: string;
  slug: string;
  short?: string | null;
}

export interface EventStatusResponse {
  id: number;
  name: string;
}

export interface Visibility {
  id: number;
  name: string;
}

export interface SeriesResponse {
  id: number;
  name: string;
  slug: string;
  short?: string | null;
}

export interface PaginatedResponse<T> {
  data: T[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  from?: number | null;
  to?: number | null;
}

export interface ApiError {
  message: string;
  errors?: Record<string, string[]>;
}
