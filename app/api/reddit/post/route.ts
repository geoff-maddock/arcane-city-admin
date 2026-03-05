import { NextRequest, NextResponse } from "next/server";
import { submitSelfPost } from "@/lib/reddit";

export interface RedditPostRequest {
  subreddit: string;
  title: string;
  body: string;
}

export interface RedditPostResponse {
  success: boolean;
  url?: string;
  name?: string;
  error?: string;
}

export async function POST(req: NextRequest) {
  try {
    const { subreddit, title, body } =
      (await req.json()) as RedditPostRequest;

    if (!subreddit || !title || !body) {
      return NextResponse.json(
        { success: false, error: "subreddit, title, and body are required" } as RedditPostResponse,
        { status: 400 }
      );
    }

    // Strip "r/" prefix if the user included it
    const cleanSubreddit = subreddit.replace(/^r\//i, "").trim();

    const result = await submitSelfPost({
      subreddit: cleanSubreddit,
      title: title.trim(),
      body,
      resubmit: true,
    });

    return NextResponse.json({
      success: true,
      url: result.url,
      name: result.name,
    } as RedditPostResponse);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Reddit post failed";
    console.error("[reddit/post]", err);
    return NextResponse.json(
      { success: false, error: msg } as RedditPostResponse,
      { status: 500 }
    );
  }
}
