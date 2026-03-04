# Arcane City Admin App — MVP Implementation Plan

## Context

Currently, adding events to arcane.city involves uploading flyers to a custom OpenAI GPT, having it extract data, and calling the Events Tracker API. The GPT approach has extensibility and reliability limitations. This plan creates a standalone Next.js admin app that replaces and improves on the GPT workflow, with a proper UI, LLM integration via Claude, a processing queue, and local deployment.

**Status: Implemented** — all phases complete as of 2026-03-02.

---

## Architecture

**Stack:** Next.js 16 (App Router) + TypeScript + Tailwind CSS v4 + Shadcn/ui v3
**LLM:** Claude API (`claude-sonnet-4-6`) — vision extraction + entity/tag matching
**API:** Arcane City REST API (Basic Auth, proxied server-side)
**State:** In-memory queue + `data/queue.json` for persistence across restarts
**Secrets:** `.env.local` (gitignored), never exposed to browser

**Why Next.js full-stack:** API keys and Basic Auth credentials stay server-side in API routes. No separate backend process. `npm run dev` to run locally.

---

## File Structure

```
arcane-city-admin/
├── app/
│   ├── layout.tsx                     # Root layout: sidebar nav, query provider
│   ├── page.tsx                       # Dashboard: live queue + recent activity
│   ├── providers.tsx                  # QueryClient + Toaster provider
│   ├── upload/page.tsx                # Flow 1: flyer upload → LLM analysis → queue
│   ├── events/page.tsx                # Event search/list
│   ├── events/[slug]/page.tsx         # Flow 2: enrich existing event
│   ├── settings/page.tsx              # Connection status + env var docs
│   └── api/
│       ├── analyze/route.ts           # POST: Claude vision extraction
│       ├── match/route.ts             # POST: Claude entity/tag matching
│       ├── enrich/route.ts            # POST: Claude event enrichment
│       ├── queue/route.ts             # GET/POST/PATCH queue state
│       ├── events/route.ts            # Proxy: GET/POST /api/events
│       ├── events/[slug]/route.ts     # Proxy: GET/PUT /api/events/{slug}
│       ├── events/[slug]/photos/route.ts  # Proxy: POST /api/events/{id}/photos
│       ├── entities/route.ts          # Proxy: GET /api/entities
│       ├── tags/route.ts              # Proxy: GET /api/tags
│       ├── event-types/route.ts       # Proxy: GET /api/event-types
│       ├── event-statuses/route.ts    # Proxy: GET /api/event-statuses
│       ├── visibilities/route.ts      # Proxy: GET /api/visibilities
│       ├── series/route.ts            # Proxy: GET /api/series
│       └── connection/route.ts        # GET: test API connection
├── components/
│   ├── ui/                            # Shadcn primitives
│   ├── layout/Sidebar.tsx
│   ├── FlyerUploader.tsx              # Drag/drop multi-image with preview
│   ├── AnalysisResult.tsx             # Claude extracted data + confidence badges
│   ├── EventForm.tsx                  # Full event edit form (all fields)
│   ├── EventQueue.tsx                 # Queue list with live status
│   ├── SmartEntitySelect.tsx          # Debounced entity search (venue/promoter)
│   └── SmartTagSelect.tsx             # Multi-select tag search
├── lib/
│   ├── claude.ts                      # Anthropic SDK client
│   ├── arcane-api.ts                  # Server-side Arcane City API client (Basic Auth)
│   ├── queue.ts                       # Queue state: in-memory + JSON persistence
│   ├── prompts.ts                     # All LLM prompt templates
│   └── utils.ts                       # cn(), date/timezone helpers
├── hooks/
│   ├── useQueue.ts                    # react-query polling, 3s interval
│   └── useApiData.ts                  # useEventTypes, useEntitySearch, useTagSearch
├── types/
│   ├── api.ts                         # EventRequest/Response, Entity, Tag, etc.
│   ├── queue.ts                       # QueueItem, QueueStatus
│   └── llm.ts                         # ExtractedEventData, MatchedEventData
├── Context/
│   ├── APIs/
│   │   └── event-tracker-api.yml      # OpenAPI 3.0.3 spec (source of truth)
│   └── Plans/
│       └── mvp-admin-app.md           # This file
├── data/                              # Gitignored runtime data
│   └── queue.json                     # Persisted queue state
├── .env.local                         # Gitignored secrets
├── .env.example                       # Committed template
├── .gitignore
├── next.config.ts
├── package.json
└── tsconfig.json
```

---

## Key Data Types

### `types/queue.ts`
```typescript
export type QueueItemStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type QueueItemAction = 'create' | 'update' | 'upload_photo';

export interface QueueItem {
  id: string;                    // UUID
  action: QueueItemAction;
  status: QueueItemStatus;
  label: string;                 // Human-readable event name
  eventData?: EventRequest;
  eventSlug?: string;            // For updates
  photoEventId?: number;         // For photo uploads (integer id, NOT slug)
  photoFile?: { name: string; dataUrl: string; mimeType: string };
  flyerDataUrl?: string;         // Preview only
  result?: { eventId?: number; eventSlug?: string; error?: string };
  retryCount: number;
  maxRetries: number;            // Default 2
  createdAt: string;
  updatedAt: string;
}
```

### `types/llm.ts`
```typescript
export interface ExtractedEventData {
  name?: string;
  date_text?: string;            // Raw: "Friday March 7th, 9pm"
  start_at_parsed?: string;      // ISO 8601 UTC if parseable
  end_at_parsed?: string | null;
  door_at_parsed?: string | null;
  venue_name?: string;           // Raw name for matching
  promoter_name?: string;
  short?: string;
  description?: string;
  presale_price?: number | null;
  door_price?: number | null;
  min_age?: number | null;
  primary_link?: string | null;
  ticket_link?: string | null;
  is_benefit?: boolean;
  tags_raw?: string[];           // Genre/theme text from flyer
  entities_raw?: string[];       // Performer/artist names
  event_type_raw?: string;
  confidence?: { name?: number; dates?: number; venue?: number; prices?: number };
  notes?: string;
}
```

---

## LLM Prompting Strategy

### Vision Extraction (`app/api/analyze/route.ts`)
- Call `claude-sonnet-4-6` with the flyer image (base64) + system prompt
- System prompt: role as Pittsburgh event data extractor, condensed EventRequest schema, rules for dates (Eastern Time → UTC), prices ("10/15" = presale/door), age restrictions, tags (be specific: "jungle" not "electronic")
- User prompt includes optional context text from the user
- Returns `ExtractedEventData` JSON

### Entity/Tag Matching (`app/api/match/route.ts`)
- Receives `ExtractedEventData`
- Fetches from Arcane City API:
  - All event types, statuses, visibilities (small lists, fetch all)
  - Entities filtered by name hints from extracted data (top 50 candidates)
  - Tags filtered by extracted `tags_raw` terms
- Sends all candidates + extracted data to Claude (text-only, no vision)
- Claude returns: `event_type_id`, `venue_id`, `promoter_id`, `tag_list[]`, `entity_list[]`, `visibility_id`
- Match threshold: >70% confidence; null for uncertain fields

### Enrichment (`app/api/enrich/route.ts`)
- Fetches existing event, user types additional info
- Prompt: show existing event JSON + new info, ask for partial `EventRequest` with only changed fields

---

## Upload Flow

```
IDLE → ANALYZING (Claude vision) → MATCHING (Claude text) → REVIEWING (EventForm) → CONFIRMED (queued)
```

- Form is fully editable; Claude's output is a starting point
- Flyer image stored as base64 in queue item; uploaded as event photo after event creation
- On match failure: form shown pre-filled with extracted data only (no IDs)

---

## Queue Processor

Location: `lib/queue.ts`

- In-memory singleton + `data/queue.json` persistence
- On restart: items in `processing` state reset to `pending`
- Sequential: one item processed at a time (`isProcessing` flag)
- On success: clear `photoFile.dataUrl` from queue item (keep metadata only)
- On failure: retry up to `maxRetries`; then mark `failed`
- Auto-continues: after each item, checks for next `pending` item via `setImmediate`

**Status flow:** `pending → processing → completed` or `failed` (with retry loop)

---

## EventForm Fields

Grouped for UX:
1. **Identity:** name, slug (auto-generated, editable), short description
2. **Classification:** event_type_id (required), event_status_id, visibility_id (default Public)
3. **Dates:** start_at (required, local TZ input → UTC), door_at, end_at
4. **Venue & Promoter:** venue_id (SmartEntitySelect, filter entity_type=Venue), promoter_id
5. **Pricing:** presale_price, door_price, min_age (0/18/21 select)
6. **Links:** primary_link, ticket_link
7. **Description:** full description textarea
8. **Tags & Entities:** tag_list (multi-select), entity_list (performers)
9. **Flags:** is_benefit, do_not_repost

**Critical:** Photo upload uses integer `id` (not `slug`) per the API spec: `POST /api/events/{id}/photos`

---

## Environment Variables

`.env.example`:
```
ARCANE_CITY_API_URL=https://arcane.city
ARCANE_CITY_USERNAME=your_username
ARCANE_CITY_PASSWORD=your_password
ANTHROPIC_API_KEY=sk-ant-...
```

All server-side only (no `NEXT_PUBLIC_` prefix). Never sent to browser.

---

## Local Setup

```bash
source ~/.nvm/nvm.sh && nvm use v22.20.0
cp .env.example .env.local
# Fill in credentials in .env.local
npm install
mkdir -p data
npm run dev
# → http://localhost:3000
```

Node.js v22+ required. Use nvm if system Node is older.

---

## Verification Checklist

1. Upload a flyer image → Claude extracts event name, date, venue
2. LLM matches venue name to entity ID from the API
3. Review form shows pre-filled data; edit a field and confirm
4. Dashboard shows queue item as `pending` then `processing` then `completed`
5. Visit arcane.city and confirm event was created with the photo
6. Search for the event, add a description → confirm update via API
7. Settings page shows "Connection OK" and masked credentials
