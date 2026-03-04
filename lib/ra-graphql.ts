const RA_GRAPHQL = "https://ra.co/graphql";
const RA_BASE = "https://ra.co";

const RA_HEADERS = {
  "Content-Type": "application/json",
  "Referer": "https://ra.co/events/us/pittsburgh",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
};

export interface RAEvent {
  id: string;
  title: string;
  date: string;         // ISO datetime e.g. "2026-03-07T21:00:00.000"
  startTime?: string;
  endTime?: string;
  eventUrl: string;     // absolute ra.co URL
  imageUrl?: string;    // first image filename (already absolute URL)
  artists: string[];
  venueName?: string;
  venueUrl?: string;
}

interface GQLResponse<T> {
  data?: T;
  errors?: { message: string }[];
}

async function raPost<T>(query: string, variables?: unknown): Promise<T> {
  const res = await fetch(RA_GRAPHQL, {
    method: "POST",
    headers: RA_HEADERS,
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`RA GraphQL HTTP ${res.status}`);
  const json: GQLResponse<T> = await res.json();
  if (json.errors?.length) throw new Error(json.errors[0].message);
  if (!json.data) throw new Error("No data in RA response");
  return json.data;
}

// Resolve area urlName → { id, name } via the areas search query
export async function resolveArea(
  urlName: string
): Promise<{ id: string; name: string } | null> {
  const data = await raPost<{ areas: { id: string; name: string; urlName: string }[] }>(
    `query { areas(searchTerm: "${urlName}") { id name urlName } }`
  );
  const match = data.areas.find(
    (a) => a.urlName.toLowerCase() === urlName.toLowerCase()
  );
  return match ? { id: match.id, name: match.name } : null;
}

const EVENT_LISTINGS_QUERY = `
query GET_EVENT_LISTINGS($filters: FilterInputDtoInput, $pageSize: Int, $page: Int) {
  eventListings(filters: $filters, pageSize: $pageSize, page: $page) {
    data {
      id
      listingDate
      event {
        id
        title
        date
        startTime
        endTime
        contentUrl
        images { id filename alt }
        artists { id name }
        venue { id name contentUrl }
      }
    }
    totalResults
  }
}
`;

export async function raFetchEvents(
  areaId: string,
  dateFrom: string,
  dateTo: string,
  page = 1,
  pageSize = 20
): Promise<{ events: RAEvent[]; totalResults: number }> {
  const data = await raPost<{
    eventListings: {
      data: {
        id: string;
        listingDate: string;
        event: {
          id: string;
          title: string;
          date: string;
          startTime?: string;
          endTime?: string;
          contentUrl?: string;
          images: { id: string; filename: string; alt?: string }[];
          artists: { id: string; name: string }[];
          venue?: { id: string; name: string; contentUrl?: string };
        };
      }[];
      totalResults: number;
    };
  }>(EVENT_LISTINGS_QUERY, {
    filters: {
      areas: { eq: parseInt(areaId, 10) },
      listingDate: { gte: dateFrom, lte: dateTo },
    },
    pageSize,
    page,
  });

  const events: RAEvent[] = data.eventListings.data.map((listing) => {
    const e = listing.event;
    const imageUrl = e.images[0]?.filename ?? undefined;
    return {
      id: e.id,
      title: e.title,
      date: e.date,
      startTime: e.startTime ?? undefined,
      endTime: e.endTime ?? undefined,
      eventUrl: e.contentUrl ? `${RA_BASE}${e.contentUrl}` : `${RA_BASE}/events/${e.id}`,
      imageUrl,
      artists: e.artists.map((a) => a.name),
      venueName: e.venue?.name ?? undefined,
      venueUrl: e.venue?.contentUrl ? `${RA_BASE}${e.venue.contentUrl}` : undefined,
    };
  });

  return { events, totalResults: data.eventListings.totalResults };
}
