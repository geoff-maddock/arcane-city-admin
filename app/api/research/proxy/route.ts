import { NextRequest, NextResponse } from "next/server";
import axios from "axios";

const MAX_BYTES = 20 * 1024 * 1024; // 20 MB

const ALLOWED_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
];

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const imageUrl = searchParams.get("url");

  if (!imageUrl) {
    return NextResponse.json({ error: "url query param is required" }, { status: 400 });
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(imageUrl);
    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return NextResponse.json(
        { error: "Only http/https URLs are supported" },
        { status: 400 }
      );
    }
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  try {
    const response = await axios.get<ArrayBuffer>(parsedUrl.href, {
      responseType: "arraybuffer",
      timeout: 10000,
      maxContentLength: MAX_BYTES,
      headers: {
        "User-Agent": BROWSER_UA,
        Accept: "image/*,*/*;q=0.8",
        Referer: `${parsedUrl.protocol}//${parsedUrl.hostname}/`,
      },
      maxRedirects: 5,
    });

    const contentType = (response.headers["content-type"] as string | undefined)
      ?.split(";")[0]
      ?.trim()
      ?.toLowerCase();

    if (!contentType || !ALLOWED_CONTENT_TYPES.includes(contentType)) {
      return NextResponse.json(
        { error: `Not a supported image type: ${contentType ?? "unknown"}` },
        { status: 415 }
      );
    }

    const buffer = Buffer.from(response.data);

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(buffer.byteLength),
        "Cache-Control": "no-store",
      },
    });
  } catch (err: unknown) {
    if (axios.isAxiosError(err)) {
      if (err.code === "ECONNABORTED") {
        return NextResponse.json({ error: "Timed out fetching image" }, { status: 504 });
      }
      if (
        err.code === "ERR_FR_MAX_BODY_LENGTH_EXCEEDED" ||
        err.message?.includes("maxContentLength")
      ) {
        return NextResponse.json({ error: "Image exceeds 20 MB limit" }, { status: 413 });
      }
      const status = err.response?.status;
      if (status === 403 || status === 401) {
        return NextResponse.json(
          { error: `Image host denied access (HTTP ${status})` },
          { status: 502 }
        );
      }
      if (status) {
        return NextResponse.json(
          { error: `Image host returned HTTP ${status}` },
          { status: 502 }
        );
      }
    }
    const msg = err instanceof Error ? err.message : "Failed to proxy image";
    console.error("[research/proxy]", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
