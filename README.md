# Arcane City Admin

Standalone admin app for managing events on [arcane.city](https://arcane.city). Upload event flyers, have Claude extract and enrich the data, review it in a form, and queue it for automatic submission to the API.

---

## Features

- **Flyer Analysis** — Upload an image and Claude (vision) extracts event name, date, venue, performers, tags, prices, and more
- **Smart Matching** — Claude cross-references extracted data against the live API to resolve entity IDs, tags, and event types
- **Review & Edit** — Pre-filled form lets you confirm or adjust before anything is submitted
- **Event Queue** — Items are queued and processed automatically in sequence with retry logic
- **Enrich Existing Events** — Search for any event and add/update info via natural language or manual editing
- **Fully Local** — Runs on `localhost:3000`, credentials never leave your machine

---

## Quick Start

### 1. Requirements

- Node.js v22+ (use [nvm](https://github.com/nvm-sh/nvm))
- An [Anthropic API key](https://console.anthropic.com/)
- Arcane City API credentials (username + password)

### 2. Install

```bash
# If using nvm
source ~/.nvm/nvm.sh && nvm use v22

npm install
```

### 3. Configure

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
ARCANE_CITY_API_URL=https://arcane.city
ARCANE_CITY_USERNAME=your_username
ARCANE_CITY_PASSWORD=your_password
ANTHROPIC_API_KEY=sk-ant-...
```

### 4. Run

```bash
mkdir -p data   # only needed once
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Usage

### Adding a New Event from a Flyer

1. Click **Add Event** or go to `/upload`
2. Drag & drop a flyer image (JPEG, PNG, WebP, GIF)
3. Optionally add context text (venue address, correct date, artist details)
4. Click **Analyze with Claude**
5. Claude extracts event data; the app matches it against the API (venues, tags, event types)
6. Review and edit the pre-filled form
7. Click **Add to Queue** — the event is created automatically, with the flyer uploaded as the photo

### Enriching an Existing Event

1. Go to **Events** and search for the event
2. Click into it
3. Type what you want to add: `"The ticket link is https://... Add tags: drum and bass, jungle"`
4. Click **Suggest Updates** — Claude proposes the changes
5. Review and click **Queue Update**

### Managing the Queue

The **Dashboard** shows the live queue with statuses:
- `pending` — waiting to be processed
- `processing` — currently submitting to the API
- `completed` — done, with a link to the event on arcane.city
- `failed` — error occurred; click retry or view the error message

The queue processes automatically. Use **Process Queue** to manually trigger if needed.

---

## Project Structure

```
arcane-city-admin/
├── app/                        # Next.js App Router pages + API routes
│   ├── page.tsx                # Dashboard (queue)
│   ├── upload/page.tsx         # Flyer upload flow
│   ├── events/                 # Event search + detail/edit
│   ├── settings/page.tsx       # Connection test + env var docs
│   └── api/                    # Server-side API routes
│       ├── analyze/            # Claude vision extraction
│       ├── match/              # Claude entity/tag matching
│       ├── enrich/             # Claude event enrichment
│       ├── queue/              # Queue CRUD
│       └── [proxy routes]      # Arcane City API proxies
├── components/                 # React components
│   ├── EventForm.tsx           # Full event editor form
│   ├── EventQueue.tsx          # Live queue display
│   ├── FlyerUploader.tsx       # Drag/drop image upload
│   ├── SmartEntitySelect.tsx   # Debounced venue/promoter search
│   ├── SmartTagSelect.tsx      # Multi-select tag search
│   └── AnalysisResult.tsx      # Claude extraction summary
├── lib/
│   ├── claude.ts               # Anthropic SDK wrapper
│   ├── arcane-api.ts           # Arcane City API client (Basic Auth)
│   ├── queue.ts                # Queue state + processor
│   ├── prompts.ts              # LLM prompt templates
│   └── utils.ts                # Slug gen, date/timezone helpers
├── hooks/                      # React Query hooks
├── types/                      # TypeScript interfaces
├── Context/
│   ├── APIs/
│   │   └── event-tracker-api.yml   # OpenAPI 3.0.3 spec (source of truth)
│   └── Plans/
│       └── mvp-admin-app.md        # Implementation plan
├── data/                       # Runtime data (gitignored)
│   └── queue.json              # Persisted queue state
├── .env.example                # Environment variable template
└── .env.local                  # Your credentials (gitignored)
```

---

## Architecture

- **Next.js 16** full-stack — React frontend + API routes in one process
- **Credentials stay server-side** — API keys and Basic Auth are only in API routes, never sent to the browser
- **Claude `claude-sonnet-4-6`** — vision for flyer analysis, text for entity/tag matching and enrichment
- **Queue persistence** — `data/queue.json` survives restarts; `processing` items auto-reset to `pending` on startup
- **React Query** — 3-second polling for live queue updates; cached lookups for event types, statuses, etc.

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `ARCANE_CITY_API_URL` | Yes | API base URL (default: `https://arcane.city`) |
| `ARCANE_CITY_API_KEY` | Optional | API key for Arcane City if you have a PAT that does not expire |
| `ARCANE_CITY_USERNAME` | Yes | Basic auth username |
| `ARCANE_CITY_PASSWORD` | Yes | Basic auth password |
| `ANTHROPIC_API_KEY` | Yes | Anthropic Claude API key |

---

## Development Notes

- **Node version:** v22+ required. System Node on WSL may be v10 — use `source ~/.nvm/nvm.sh && nvm use v22`
- **Queue file:** `data/queue.json` is gitignored. Create `data/` with `mkdir -p data` before first run.
- **Photo uploads:** The API uses integer event `id` (not `slug`) for photo uploads — handled automatically.
- **Timezone:** Event times are stored as UTC. The form displays in your local timezone and converts on submit.
- **API spec:** `Context/APIs/event-tracker-api.yml` is the authoritative reference for all fields and endpoints.
