"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, Globe, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EventForm } from "@/components/EventForm";
import { AnalysisResult } from "@/components/AnalysisResult";
import { useQueueMutations } from "@/hooks/useQueue";
import type { ExtractedEventData, MatchedEventData } from "@/types/llm";
import type { EventRequest } from "@/types/api";
import type { FlyerFile } from "@/components/FlyerUploader";
import { generateSlug } from "@/lib/utils";
import type { ImageCandidate, ResearchResponse } from "@/app/api/research/route";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

interface ResultsData {
  images: ImageCandidate[];
  pageTitle?: string;
  sourceUrl: string;
  queued: string[]; // srcs already added to queue
}

type Step =
  | { id: "idle" }
  | { id: "searching" }
  | { id: "results" }
  | { id: "fetching"; selected: ImageCandidate }
  | { id: "analyzing"; flyerFile: FlyerFile }
  | { id: "matching"; extracted: ExtractedEventData; flyerFile: FlyerFile }
  | { id: "review"; matched: MatchedEventData; flyerFile: FlyerFile };

// ─── ImageCard ────────────────────────────────────────────────────────────────

interface ImageCardProps {
  candidate: ImageCandidate;
  isQueued: boolean;
  isActive: boolean; // currently being fetched/analyzed
  disabled: boolean;
  onAnalyze: (candidate: ImageCandidate) => void;
}

function ImageCard({ candidate, isQueued, isActive, disabled, onAnalyze }: ImageCardProps) {
  return (
    <div className="relative group rounded-lg overflow-hidden border bg-muted aspect-square">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={candidate.src}
        alt={candidate.alt ?? "Image candidate"}
        className="w-full h-full object-cover"
        loading="lazy"
      />

      {isQueued && (
        <div className="absolute top-2 right-2">
          <Badge className="bg-green-500 text-white border-0 gap-1 text-xs">
            <CheckCircle2 className="h-3 w-3" />
            Queued
          </Badge>
        </div>
      )}

      {isActive && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-white" />
        </div>
      )}

      {!isQueued && !isActive && (
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 p-2">
          <Button size="sm" onClick={() => onAnalyze(candidate)} disabled={disabled}>
            Analyze
          </Button>
          {candidate.alt && (
            <p className="text-white text-xs text-center line-clamp-2">{candidate.alt}</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Step labels ──────────────────────────────────────────────────────────────

const STEP_LABELS: Partial<Record<Step["id"], { main: string; sub: string }>> = {
  fetching: { main: "Fetching image…", sub: "Downloading through proxy" },
  analyzing: { main: "Claude is analyzing the flyer…", sub: "Extracting event details from the image" },
  matching: { main: "Matching against API data…", sub: "Resolving entities, tags, and event types" },
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ResearchPage() {
  const [step, setStep] = useState<Step>({ id: "idle" });
  const [urlInput, setUrlInput] = useState("");
  const [searchError, setSearchError] = useState<string | null>(null);
  const [results, setResults] = useState<ResultsData | null>(null);
  const [activeImageSrc, setActiveImageSrc] = useState("");
  const { addItem } = useQueueMutations();

  // ── Search ──────────────────────────────────────────────────────────────────

  const handleSearch = useCallback(async () => {
    const trimmed = urlInput.trim();
    if (!trimmed) return;

    setSearchError(null);
    setStep({ id: "searching" });
    setResults(null);
    setActiveImageSrc("");

    try {
      const res = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed }),
      });

      const data = (await res.json()) as ResearchResponse & { error?: string };

      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);

      setResults({ images: data.images, pageTitle: data.pageTitle, sourceUrl: trimmed, queued: [] });
      setStep({ id: "results" });

      if (data.images.length === 0) {
        setSearchError("No candidate images found on that page. Try a different URL.");
      }
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : "Failed to fetch page");
      setStep({ id: "idle" });
    }
  }, [urlInput]);

  // ── Analyze ─────────────────────────────────────────────────────────────────

  const handleAnalyzeImage = useCallback(
    async (candidate: ImageCandidate) => {
      setActiveImageSrc(candidate.src);
      setStep({ id: "fetching", selected: candidate });

      // Phase 1: Proxy → blob → File
      let flyerFile: FlyerFile;
      try {
        const proxyRes = await fetch(
          `/api/research/proxy?url=${encodeURIComponent(candidate.src)}`
        );
        if (!proxyRes.ok) {
          const err = await proxyRes.json().catch(() => ({})) as { error?: string };
          throw new Error(err.error ?? `Proxy failed: HTTP ${proxyRes.status}`);
        }

        const blob = await proxyRes.blob();
        const filename =
          new URL(candidate.src).pathname.split("/").pop() || "flyer.jpg";
        const file = new File([blob], filename, { type: blob.type || "image/jpeg" });
        const previewUrl = URL.createObjectURL(blob);
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });

        flyerFile = { file, previewUrl, dataUrl };
      } catch (err) {
        toast.error(`Could not load image: ${err instanceof Error ? err.message : "Unknown error"}`);
        setStep({ id: "results" });
        return;
      }

      // Phase 2: Analyze with Claude
      setStep({ id: "analyzing", flyerFile });
      let extracted: ExtractedEventData;
      try {
        const formData = new FormData();
        formData.append("image", flyerFile.file);
        if (results?.sourceUrl) {
          formData.append("context", `Source URL: ${results.sourceUrl}`);
        }

        const analyzeRes = await fetch("/api/analyze", { method: "POST", body: formData });
        const analyzeData = await analyzeRes.json();
        if (!analyzeData.success || !analyzeData.extracted) {
          throw new Error(analyzeData.error ?? "Analysis failed");
        }
        extracted = analyzeData.extracted;
      } catch (err) {
        toast.error(`Analysis failed: ${err instanceof Error ? err.message : "Unknown error"}`);
        setStep({ id: "results" });
        return;
      }

      // Phase 3: Match entities/tags
      setStep({ id: "matching", extracted, flyerFile });
      try {
        const matchRes = await fetch("/api/match", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ extracted }),
        });
        const matchData = await matchRes.json();
        if (!matchData.success || !matchData.matched) {
          throw new Error(matchData.error ?? "Matching failed");
        }

        if (!matchData.matched.proposedEvent.slug && matchData.matched.proposedEvent.name) {
          matchData.matched.proposedEvent.slug = generateSlug(matchData.matched.proposedEvent.name);
        }

        setStep({ id: "review", matched: matchData.matched, flyerFile });
      } catch (err) {
        // Graceful fallback: let user edit with partial data (mirrors upload page behavior)
        toast.error("Matching failed — you can still edit the form manually.");
        const partialMatched: MatchedEventData = {
          extracted,
          matched: {},
          proposedEvent: {
            name: extracted.name ?? "",
            slug: generateSlug(extracted.name ?? ""),
            start_at: extracted.start_at_parsed ?? "",
            short: extracted.short ?? null,
            description: extracted.description ?? null,
            presale_price: extracted.presale_price ?? null,
            door_price: extracted.door_price ?? null,
            min_age: extracted.min_age ?? null,
            primary_link: extracted.primary_link ?? null,
            ticket_link: extracted.ticket_link ?? null,
            is_benefit: extracted.is_benefit ?? false,
            event_type_id: 0,
            visibility_id: 0,
            tag_list: [],
            entity_list: [],
          },
        };
        setStep({ id: "review", matched: partialMatched, flyerFile });
      }
    },
    [results]
  );

  // ── Confirm ─────────────────────────────────────────────────────────────────

  const handleConfirm = useCallback(
    (eventData: EventRequest) => {
      if (step.id !== "review") return;
      const { flyerFile } = step;
      const srcToMark = activeImageSrc;

      addItem.mutate(
        {
          action: "create",
          label: eventData.name,
          eventData,
          photoFile: {
            name: flyerFile.file.name,
            dataUrl: flyerFile.dataUrl,
            mimeType: flyerFile.file.type,
          },
          flyerDataUrl: flyerFile.dataUrl,
          maxRetries: 2,
        },
        {
          onSuccess: () => {
            URL.revokeObjectURL(flyerFile.previewUrl);
            toast.success(`"${eventData.name}" added to queue!`);
            setResults((prev) =>
              prev ? { ...prev, queued: [...prev.queued, srcToMark] } : prev
            );
            setStep({ id: "results" });
          },
          onError: (err) => {
            toast.error(err instanceof Error ? err.message : "Failed to add to queue");
          },
        }
      );
    },
    [step, activeImageSrc, addItem]
  );

  const handleBackToResults = useCallback(() => {
    if (step.id === "review") {
      URL.revokeObjectURL(step.flyerFile.previewUrl);
    }
    setStep({ id: "results" });
  }, [step]);

  // ── Derived ─────────────────────────────────────────────────────────────────

  const isSearching = step.id === "searching";
  const isAnalyzing = ["fetching", "analyzing", "matching"].includes(step.id);
  const stepLabel = STEP_LABELS[step.id as keyof typeof STEP_LABELS];

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Research</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Fetch a page and browse its event flyer images to analyze and queue
        </p>
      </div>

      {/* URL search bar */}
      <div className="flex gap-2">
        <Input
          type="url"
          placeholder="https://venue.com/events  or  https://instagram.com/p/…"
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !isSearching) handleSearch();
          }}
          disabled={isSearching}
          className="flex-1"
        />
        <Button
          onClick={handleSearch}
          disabled={!urlInput.trim() || isSearching}
        >
          {isSearching ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Searching…
            </>
          ) : (
            <>
              <Search className="h-4 w-4 mr-2" />
              Search
            </>
          )}
        </Button>
      </div>

      {searchError && (
        <p className="text-sm text-destructive">{searchError}</p>
      )}

      {/* Inline status card during fetch/analyze/match */}
      {isAnalyzing && stepLabel && (
        <Card>
          <CardContent className="flex items-center gap-4 py-6">
            <Loader2 className="h-8 w-8 animate-spin text-primary shrink-0" />
            <div>
              <p className="font-medium">{stepLabel.main}</p>
              <p className="text-sm text-muted-foreground">{stepLabel.sub}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results grid — persists through all non-review steps */}
      {results && step.id !== "review" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">
                {results.pageTitle ? `"${results.pageTitle}"` : "Results"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {results.images.length} image{results.images.length !== 1 ? "s" : ""} found
                {results.queued.length > 0 && (
                  <span className="text-green-600 dark:text-green-400">
                    {" "}· {results.queued.length} queued
                  </span>
                )}
              </p>
            </div>
            <a
              href={results.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:underline"
            >
              <Globe className="h-3 w-3" />
              {(() => {
                try { return new URL(results.sourceUrl).hostname; } catch { return results.sourceUrl; }
              })()}
            </a>
          </div>

          {results.images.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {results.images.map((img) => (
                <ImageCard
                  key={img.src}
                  candidate={img}
                  isQueued={results.queued.includes(img.src)}
                  isActive={activeImageSrc === img.src && isAnalyzing}
                  disabled={step.id !== "results"}
                  onAnalyze={handleAnalyzeImage}
                />
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                No candidate images found on this page.
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Review pane — replaces grid */}
      {step.id === "review" && (() => {
        const { matched, flyerFile } = step;
        return (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={handleBackToResults} title="Back to results">
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <h2 className="text-xl font-bold">Review Event</h2>
                <p className="text-muted-foreground text-sm">
                  Edit any fields before adding to the queue
                </p>
              </div>
            </div>

            <div className={cn("grid gap-6", "grid-cols-1 lg:grid-cols-3")}>
              {/* Left: flyer preview + extracted data */}
              <div className="lg:col-span-1 space-y-4">
                <Card>
                  <CardContent className="pt-4">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={flyerFile.previewUrl}
                      alt="Event flyer"
                      className="w-full rounded object-contain max-h-64"
                    />
                  </CardContent>
                </Card>
                <AnalysisResult extracted={matched.extracted} />
              </div>

              {/* Right: event form */}
              <div className="lg:col-span-2">
                <EventForm
                  initialData={matched.proposedEvent}
                  onSubmit={handleConfirm}
                  onCancel={handleBackToResults}
                  isSubmitting={addItem.isPending}
                  submitLabel="Add to Queue"
                />
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
