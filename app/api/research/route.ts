import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import * as cheerio from "cheerio";
import { resolveArea, raFetchEvents } from "@/lib/ra-graphql";

export interface ImageCandidate {
  src: string;
  alt?: string;
  width?: number;
  height?: number;
  // RA-specific enrichment (present when sourced from RA GraphQL)
  eventTitle?: string;
  eventDate?: string;
  eventUrl?: string;
  artists?: string[];
  venueName?: string;
}

export interface ResearchResponse {
  images: ImageCandidate[];
  pageTitle?: string;
}

const SKIP_PATH_PATTERNS = [
  /\/icon/i,
  /\/logo/i,
  /\/favicon/i,
  /\/badge/i,
  /\/pixel/i,
  /\/tracking/i,
  /\/spinner/i,
  /\/avatar/i,
  /\/profile/i,
  /\/emoji/i,
];

const SKIP_EXTENSIONS = [".svg", ".gif"];

function isSkippable(src: string): boolean {
  try {
    const url = new URL(src);
    const path = url.pathname.toLowerCase();
    if (SKIP_EXTENSIONS.some((ext) => path.endsWith(ext))) return true;
    if (SKIP_PATH_PATTERNS.some((p) => p.test(path))) return true;
  } catch {
    return true;
  }
  return false;
}

function normalizeUrl(src: string, baseUrl: string): string | null {
  if (!src || src.startsWith("data:")) return null;
  try {
    return new URL(src, baseUrl).href;
  } catch {
    return null;
  }
}

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { url?: string };
    const rawUrl = body.url?.trim();

    if (!rawUrl) {
      return NextResponse.json({ error: "url is required" }, { status: 400 });
    }

    let targetUrl: string;
    try {
      const parsed = new URL(rawUrl);
      if (!["http:", "https:"].includes(parsed.protocol)) {
        return NextResponse.json(
          { error: "Only http/https URLs are supported" },
          { status: 400 }
        );
      }
      targetUrl = parsed.href;
    } catch {
      return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
    }

    // ─── RA.co: use GraphQL instead of HTML scraping ─────────────────────────
    const parsedUrl = new URL(targetUrl);
    if (parsedUrl.hostname === "ra.co" || parsedUrl.hostname === "www.ra.co") {
      // Extract area slug from path like /events/us/pittsburgh → "pittsburgh"
      const pathParts = parsedUrl.pathname.replace(/^\/+|\/+$/g, "").split("/");
      // Path: events / <country> / <city>  OR  events / <city>
      const areaSlug = pathParts.length >= 3 ? pathParts[2] : pathParts[pathParts.length - 1];

      if (!areaSlug) {
        return NextResponse.json(
          { error: "Could not determine area from RA URL. Use a URL like ra.co/events/us/pittsburgh" },
          { status: 400 }
        );
      }

      const area = await resolveArea(areaSlug);
      if (!area) {
        return NextResponse.json(
          { error: `Could not find RA area for "${areaSlug}". Check the city slug in the URL.` },
          { status: 404 }
        );
      }

      const today = new Date().toISOString().split("T")[0];
      const twoWeeksOut = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];

      const { events } = await raFetchEvents(area.id, today, twoWeeksOut);

      const images: ImageCandidate[] = events
        .filter((e) => e.imageUrl)
        .map((e) => ({
          src: e.imageUrl!,
          alt: e.title,
          eventTitle: e.title,
          eventDate: e.startTime ?? e.date,
          eventUrl: e.eventUrl,
          artists: e.artists.length > 0 ? e.artists : undefined,
          venueName: e.venueName,
        }));

      return NextResponse.json({
        images,
        pageTitle: `RA ${area.name} Events`,
      } satisfies ResearchResponse);
    }
    // ─────────────────────────────────────────────────────────────────────────

    const htmlResponse = await axios.get<string>(targetUrl, {
      timeout: 15000,
      responseType: "text",
      headers: {
        "User-Agent": BROWSER_UA,
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
      maxRedirects: 5,
    });

    const $ = cheerio.load(htmlResponse.data);
    const pageTitle = $("title").first().text().trim() || undefined;

    const seen = new Set<string>();
    const ogImages: ImageCandidate[] = [];
    const bodyImages: ImageCandidate[] = [];

    // Open Graph / Twitter card images — usually the best event graphic
    $('meta[property="og:image"], meta[name="twitter:image"]').each((_i, el) => {
      const content = $(el).attr("content");
      if (!content) return;
      const normalized = normalizeUrl(content, targetUrl);
      if (!normalized || seen.has(normalized) || isSkippable(normalized)) return;
      seen.add(normalized);
      ogImages.push({ src: normalized });
    });

    // All <img> tags — also check common lazy-load attributes
    $("img").each((_i, el) => {
      const raw =
        $(el).attr("src") ||
        $(el).attr("data-src") ||
        $(el).attr("data-lazy-src") ||
        $(el).attr("data-original") ||
        "";
      if (!raw) return;

      const normalized = normalizeUrl(raw, targetUrl);
      if (!normalized || seen.has(normalized) || isSkippable(normalized)) return;

      const widthAttr = $(el).attr("width");
      const heightAttr = $(el).attr("height");
      const width = widthAttr ? parseInt(widthAttr, 10) : undefined;
      const height = heightAttr ? parseInt(heightAttr, 10) : undefined;

      // Skip explicitly tiny images
      if (width !== undefined && height !== undefined && width < 50 && height < 50) return;

      seen.add(normalized);
      bodyImages.push({
        src: normalized,
        alt: $(el).attr("alt")?.trim() || undefined,
        width: width && !isNaN(width) ? width : undefined,
        height: height && !isNaN(height) ? height : undefined,
      });
    });

    // CSS background-image in inline styles (e.g. Webflow, Squarespace sites)
    // Matches: style="background-image:url('https://...')" or url("...") or url(...)
    const bgUrlRegex = /background-image\s*:\s*url\(\s*["']?([^"')]+)["']?\s*\)/i;
    $("[style*='background-image']").each((_i, el) => {
      const style = $(el).attr("style") ?? "";
      const match = bgUrlRegex.exec(style);
      if (!match) return;
      const raw = match[1].trim();
      const normalized = normalizeUrl(raw, targetUrl);
      if (!normalized || seen.has(normalized) || isSkippable(normalized)) return;
      seen.add(normalized);
      bodyImages.push({ src: normalized });
    });

    // OG images first, then sort body images by area descending (unsized last)
    bodyImages.sort((a, b) => {
      const aArea = (a.width ?? 0) * (a.height ?? 0);
      const bArea = (b.width ?? 0) * (b.height ?? 0);
      return bArea - aArea;
    });

    return NextResponse.json({
      images: [...ogImages, ...bodyImages],
      pageTitle,
    } satisfies ResearchResponse);
  } catch (err: unknown) {
    if (axios.isAxiosError(err)) {
      if (err.code === "ECONNABORTED") {
        return NextResponse.json(
          { error: "Request timed out fetching the URL" },
          { status: 504 }
        );
      }
      if (err.response?.status) {
        return NextResponse.json(
          { error: `Target server returned HTTP ${err.response.status}` },
          { status: 502 }
        );
      }
    }
    const msg = err instanceof Error ? err.message : "Failed to fetch page";
    console.error("[research]", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
