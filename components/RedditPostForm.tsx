"use client";

import { useState } from "react";
import {
  AlertTriangle,
  Bot,
  ExternalLink,
  Loader2,
  Send,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import type { EventResponse } from "@/types/api";

interface RedditGenerateResponse {
  success: boolean;
  title?: string;
  body?: string;
  defaultSubreddits?: string[];
  error?: string;
}

interface RedditPostResponse {
  success: boolean;
  url?: string;
  name?: string;
  error?: string;
}

interface SubredditResult {
  subreddit: string;
  url: string | null;
  error: string | null;
}

interface RedditPostFormProps {
  event: EventResponse;
  slug: string;
}

export function RedditPostForm({ event, slug }: RedditPostFormProps) {
  const [subredditInput, setSubredditInput] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [results, setResults] = useState<SubredditResult[]>([]);
  const [warningAcknowledged, setWarningAcknowledged] = useState(false);

  const doNotRepost = event.do_not_repost === true;
  const hasContent =
    title.trim().length > 0 &&
    body.trim().length > 0 &&
    subredditInput.trim().length > 0;

  const parseSubreddits = (): string[] =>
    subredditInput
      .split(",")
      .map((s) => s.trim().replace(/^r\//i, ""))
      .filter(Boolean);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setResults([]);
    try {
      const res = await fetch("/api/reddit/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      });
      const data: RedditGenerateResponse = await res.json();
      if (!data.success) throw new Error(data.error || "Generation failed");

      setTitle(data.title ?? "");
      setBody(data.body ?? "");

      if (!subredditInput && data.defaultSubreddits?.length) {
        setSubredditInput(data.defaultSubreddits.join(", "));
      }

      toast.success("Post content generated — review and edit before posting.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePost = async () => {
    const subreddits = parseSubreddits();
    if (!subreddits.length) {
      toast.error("Enter at least one subreddit.");
      return;
    }

    setIsPosting(true);
    setResults([]);

    const newResults: SubredditResult[] = [];

    for (const subreddit of subreddits) {
      try {
        const res = await fetch("/api/reddit/post", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subreddit, title, body }),
        });
        const data: RedditPostResponse = await res.json();
        if (!data.success) throw new Error(data.error || "Post failed");

        newResults.push({ subreddit, url: data.url ?? null, error: null });
        toast.success(`Posted to r/${subreddit}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Post failed";
        newResults.push({ subreddit, url: null, error: msg });
        toast.error(`Failed r/${subreddit}: ${msg}`);
      }
      setResults([...newResults]);
    }

    setIsPosting(false);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Bot className="h-4 w-4 text-orange-500" />
          Share to Reddit
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {doNotRepost && !warningAcknowledged ? (
          <div className="flex items-start gap-2 rounded-md border border-yellow-500/30 bg-yellow-500/10 p-3 text-sm text-yellow-700 dark:text-yellow-400">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <div className="space-y-2">
              <p className="font-medium">
                This event is marked &ldquo;Do Not Repost&rdquo;
              </p>
              <p className="text-xs opacity-80">
                The promoter or organizer has requested this event not be
                re-shared. Only proceed if you have explicit permission.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="border-yellow-500/50 text-yellow-700 hover:bg-yellow-500/20"
                onClick={() => setWarningAcknowledged(true)}
              >
                I understand, proceed anyway
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="subreddits">
                Subreddits{" "}
                <span className="text-muted-foreground font-normal">
                  (comma-separated)
                </span>
              </Label>
              <Input
                id="subreddits"
                value={subredditInput}
                onChange={(e) => setSubredditInput(e.target.value)}
                placeholder="pittsburgh, pittsburghmusic"
                disabled={isPosting}
              />
              <p className="text-xs text-muted-foreground">
                Include or omit &ldquo;r/&rdquo; — both work
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="reddit-title">Post Title</Label>
              <Input
                id="reddit-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder='e.g. "Upcoming Show: Artist at Venue — Fri Mar 7"'
                disabled={isPosting}
                maxLength={300}
              />
              <p className="text-xs text-muted-foreground text-right">
                {title.length}/300
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="reddit-body">Post Body</Label>
              <Textarea
                id="reddit-body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={10}
                disabled={isPosting}
                className="font-mono text-sm"
                placeholder="Click &quot;Generate with AI&quot; to create post content, or write your own Reddit markdown..."
              />
            </div>

            <div className="flex gap-2 flex-wrap">
              <Button
                variant="outline"
                onClick={handleGenerate}
                disabled={isGenerating || isPosting}
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Bot className="h-4 w-4 mr-2" />
                    Generate with AI
                  </>
                )}
              </Button>

              <Button
                onClick={handlePost}
                disabled={!hasContent || isPosting || isGenerating}
                className="bg-orange-600 hover:bg-orange-700 text-white"
              >
                {isPosting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Posting...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Post to Reddit
                  </>
                )}
              </Button>
            </div>

            {results.length > 0 && (
              <div className="space-y-2 pt-1">
                {results.map((r) => (
                  <div
                    key={r.subreddit}
                    className={`flex items-center justify-between rounded-md px-3 py-2 text-sm border ${
                      r.error
                        ? "border-destructive/30 bg-destructive/10 text-destructive"
                        : "border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs font-mono">
                        r/{r.subreddit}
                      </Badge>
                      <span>{r.error ?? "Posted successfully"}</span>
                    </div>
                    {r.url && (
                      <a
                        href={r.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 underline underline-offset-2 shrink-0 ml-2"
                      >
                        View
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
