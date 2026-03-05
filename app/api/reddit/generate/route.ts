import { NextRequest, NextResponse } from "next/server";
import { arcaneApi } from "@/lib/arcane-api";
import { generateRedditPost } from "@/lib/claude";

export interface RedditGenerateResponse {
  success: boolean;
  title?: string;
  body?: string;
  defaultSubreddits?: string[];
  error?: string;
}

export async function POST(req: NextRequest) {
  try {
    const { slug } = (await req.json()) as { slug: string };

    if (!slug) {
      return NextResponse.json(
        { success: false, error: "slug is required" } as RedditGenerateResponse,
        { status: 400 }
      );
    }

    const event = await arcaneApi.getEvent(slug);
    const { title, body } = await generateRedditPost(event);

    const defaultSubreddits = (process.env.REDDIT_DEFAULT_SUBREDDITS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    return NextResponse.json({
      success: true,
      title,
      body,
      defaultSubreddits,
    } as RedditGenerateResponse);
  } catch (err: unknown) {
    const msg =
      err instanceof Error ? err.message : "Reddit post generation failed";
    console.error("[reddit/generate]", err);
    return NextResponse.json(
      { success: false, error: msg } as RedditGenerateResponse,
      { status: 500 }
    );
  }
}
