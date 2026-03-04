"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FlyerUploader, type FlyerFile } from "@/components/FlyerUploader";
import { AnalysisResult } from "@/components/AnalysisResult";
import { EventForm } from "@/components/EventForm";
import { useQueueMutations } from "@/hooks/useQueue";
import type { ExtractedEventData, MatchedEventData } from "@/types/llm";
import type { EventRequest } from "@/types/api";
import { generateSlug } from "@/lib/utils";

type Step =
  | { id: "upload" }
  | { id: "analyzing" }
  | { id: "matching"; extracted: ExtractedEventData; flyerFile: FlyerFile }
  | { id: "review"; matched: MatchedEventData; flyerFile: FlyerFile }
  | { id: "done"; label: string };

export default function UploadPage() {
  const [step, setStep] = useState<Step>({ id: "upload" });
  const [files, setFiles] = useState<FlyerFile[]>([]);
  const [context, setContext] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isMatching, setIsMatching] = useState(false);
  const { addItem } = useQueueMutations();

  const reset = useCallback(() => {
    setStep({ id: "upload" });
    setFiles([]);
    setContext("");
    setIsAnalyzing(false);
    setIsMatching(false);
  }, []);

  const handleAnalyze = async () => {
    if (files.length === 0) {
      toast.error("Please upload at least one flyer image.");
      return;
    }

    const flyerFile = files[0]; // Analyze first image
    setIsAnalyzing(true);
    setStep({ id: "analyzing" });

    try {
      const formData = new FormData();
      formData.append("image", flyerFile.file);
      if (context.trim()) formData.append("context", context.trim());

      const res = await fetch("/api/analyze", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (!data.success || !data.extracted) {
        throw new Error(data.error || "Analysis failed");
      }

      setStep({ id: "matching", extracted: data.extracted, flyerFile });
      await handleMatch(data.extracted, flyerFile);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Analysis failed";
      toast.error(msg);
      setStep({ id: "upload" });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleMatch = async (extracted: ExtractedEventData, flyerFile: FlyerFile) => {
    setIsMatching(true);
    try {
      const res = await fetch("/api/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ extracted }),
      });
      const data = await res.json();

      if (!data.success || !data.matched) {
        throw new Error(data.error || "Matching failed");
      }

      // Auto-generate slug from name if not set
      if (!data.matched.proposedEvent.slug && data.matched.proposedEvent.name) {
        data.matched.proposedEvent.slug = generateSlug(data.matched.proposedEvent.name);
      }

      setStep({ id: "review", matched: data.matched, flyerFile });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Matching failed";
      toast.error(`Matching failed: ${msg}. You can still edit the form manually.`);
      // Still show review but with just the extracted data
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
    } finally {
      setIsMatching(false);
    }
  };

  const handleConfirm = async (eventData: EventRequest, flyerFile: FlyerFile) => {
    // Build the photo file entry from the flyer
    const photoFile = {
      name: flyerFile.file.name,
      dataUrl: flyerFile.dataUrl,
      mimeType: flyerFile.file.type,
    };

    addItem.mutate(
      {
        action: "create",
        label: eventData.name,
        eventData,
        photoFile,
        flyerDataUrl: flyerFile.dataUrl,
        maxRetries: 2,
      },
      {
        onSuccess: () => {
          toast.success(`"${eventData.name}" added to queue!`);
          setStep({ id: "done", label: eventData.name });
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : "Failed to add to queue");
        },
      }
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────

  if (step.id === "done") {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <CheckCircle2 className="h-12 w-12 text-green-500" />
            <h2 className="text-xl font-semibold">Added to Queue!</h2>
            <p className="text-muted-foreground text-center">
              &ldquo;{step.label}&rdquo; is queued and will be processed automatically.
            </p>
            <div className="flex gap-3">
              <Button variant="outline" onClick={reset}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Add Another
              </Button>
              <Button asChild>
                <a href="/">View Queue</a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step.id === "analyzing" || step.id === "matching") {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-lg font-medium">
              {step.id === "analyzing"
                ? "Claude is analyzing the flyer..."
                : "Matching against API data..."}
            </p>
            <p className="text-sm text-muted-foreground text-center max-w-xs">
              {step.id === "analyzing"
                ? "Extracting event details from the image"
                : "Resolving entities, tags, and event types"}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step.id === "review") {
    const { matched, flyerFile } = step;
    return (
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={reset}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Review Event</h1>
            <p className="text-muted-foreground text-sm">Edit any fields before adding to the queue</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-4">
            {/* Flyer preview */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Flyer</CardTitle>
              </CardHeader>
              <CardContent>
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
          <div className="lg:col-span-2">
            <EventForm
              initialData={matched.proposedEvent}
              onSubmit={(data) => handleConfirm(data, flyerFile)}
              onCancel={reset}
              isSubmitting={addItem.isPending}
              submitLabel="Add to Queue"
            />
          </div>
        </div>
      </div>
    );
  }

  // Default: upload step
  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Add Event from Flyer</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Upload a flyer image — Claude will extract event details automatically
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Upload Flyer</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <FlyerUploader
            onFilesReady={setFiles}
            disabled={isAnalyzing}
          />

          <div>
            <Label htmlFor="context">Additional Context (optional)</Label>
            <Textarea
              id="context"
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="Any extra info: venue address, artist details, correct date if unclear..."
              rows={3}
              disabled={isAnalyzing}
            />
          </div>
        </CardContent>
      </Card>

      <Button
        size="lg"
        className="w-full"
        onClick={handleAnalyze}
        disabled={files.length === 0 || isAnalyzing}
      >
        {isAnalyzing ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Analyzing...
          </>
        ) : (
          <>
            <ArrowRight className="h-4 w-4 mr-2" />
            Analyze with Claude
          </>
        )}
      </Button>
    </div>
  );
}
