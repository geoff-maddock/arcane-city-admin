"use client";

import { use, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft,
  ExternalLink,
  Loader2,
  Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { EventForm } from "@/components/EventForm";
import { useQueueMutations } from "@/hooks/useQueue";
import { formatEventDate } from "@/lib/utils";
import type { EventResponse } from "@/types/api";
import type { EventRequest } from "@/types/api";

// Convert EventResponse (which allows null) to Partial<EventRequest> (which uses undefined)
function toEventRequest(
  event: EventResponse,
  overrides?: Partial<EventRequest> | null
): Partial<EventRequest> {
  return {
    name: event.name,
    slug: event.slug,
    start_at: event.start_at,
    event_type_id: event.event_type_id ?? undefined,
    visibility_id: event.visibility_id ?? undefined,
    short: event.short ?? undefined,
    description: event.description ?? undefined,
    event_status_id: event.event_status_id ?? undefined,
    venue_id: event.venue_id ?? undefined,
    promoter_id: event.promoter_id ?? undefined,
    series_id: event.series_id ?? undefined,
    door_at: event.door_at ?? undefined,
    end_at: event.end_at ?? undefined,
    presale_price: event.presale_price ?? undefined,
    door_price: event.door_price ?? undefined,
    min_age: event.min_age ?? undefined,
    primary_link: event.primary_link ?? undefined,
    ticket_link: event.ticket_link ?? undefined,
    is_benefit: event.is_benefit,
    do_not_repost: event.do_not_repost,
    tag_list: event.tags?.map((t) => t.id) ?? [],
    entity_list: event.entities?.map((e) => e.id) ?? [],
    ...overrides,
  };
}

export default function EventDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const [enrichText, setEnrichText] = useState("");
  const [isEnriching, setIsEnriching] = useState(false);
  const [enrichUpdates, setEnrichUpdates] = useState<Partial<EventRequest> | null>(null);
  const [showForm, setShowForm] = useState(false);
  const { addItem } = useQueueMutations();

  const { data: event, isLoading, error } = useQuery<EventResponse>({
    queryKey: ["event", slug],
    queryFn: async () => {
      const res = await fetch(`/api/events/${slug}`);
      if (!res.ok) throw new Error("Failed to load event");
      return res.json();
    },
  });

  const handleEnrich = async () => {
    if (!enrichText.trim()) return;
    setIsEnriching(true);
    try {
      const res = await fetch("/api/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, additionalInfo: enrichText }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Enrichment failed");
      setEnrichUpdates(data.updates);
      setShowForm(true);
      toast.success("Claude proposed updates — review and confirm below.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Enrichment failed");
    } finally {
      setIsEnriching(false);
    }
  };

  const handleUpdate = (data: EventRequest) => {
    addItem.mutate(
      {
        action: "update",
        label: `Update: ${event?.name ?? slug}`,
        eventSlug: slug,
        eventData: data,
        maxRetries: 2,
      },
      {
        onSuccess: () => {
          toast.success("Update queued!");
          setShowForm(false);
          setEnrichUpdates(null);
          setEnrichText("");
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : "Failed to queue update");
        },
      }
    );
  };

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <Card>
          <CardContent className="py-8 text-center text-destructive text-sm">
            Failed to load event &quot;{slug}&quot;.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/events">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold truncate">{event.name}</h1>
          <p className="text-sm text-muted-foreground">
            {event.start_at ? formatEventDate(event.start_at) : "No date"}
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <a
            href={`https://arcane.city/events/${slug}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
            View
          </a>
        </Button>
      </div>

      {/* Event summary */}
      <Card>
        <CardContent className="flex gap-4 py-4">
          {event.primary_photo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={event.primary_photo}
              alt="Event photo"
              className="h-24 w-24 rounded object-cover shrink-0"
            />
          )}
          <div className="space-y-1.5 flex-1 min-w-0">
            {event.short && (
              <p className="text-sm text-muted-foreground">{event.short}</p>
            )}
            <div className="flex flex-wrap gap-1.5">
              {event.event_type && (
                <Badge variant="secondary">{event.event_type.name}</Badge>
              )}
              {event.event_status && (
                <Badge variant="outline">{event.event_status.name}</Badge>
              )}
              {event.venue && (
                <Badge variant="outline">{event.venue.name}</Badge>
              )}
              {event.tags?.map((t) => (
                <Badge key={t.id} variant="outline" className="text-xs">
                  {t.name}
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* AI Enrichment */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Wand2 className="h-4 w-4 text-primary" />
            Add Info with AI
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label htmlFor="enrich">Describe what to add or change</Label>
            <Textarea
              id="enrich"
              value={enrichText}
              onChange={(e) => setEnrichText(e.target.value)}
              placeholder="e.g. The ticket link is https://... The venue is Brillobox at 4104 Penn Ave. Add tags: drum and bass, jungle"
              rows={3}
              disabled={isEnriching}
            />
          </div>
          <Button
            onClick={handleEnrich}
            disabled={!enrichText.trim() || isEnriching}
          >
            {isEnriching ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Asking Claude...
              </>
            ) : (
              <>
                <Wand2 className="h-4 w-4 mr-2" />
                Suggest Updates
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Manual edit / confirm enrichment form */}
      {showForm && (
        <div>
          <h2 className="text-lg font-semibold mb-3">
            {enrichUpdates ? "Review Proposed Updates" : "Edit Event"}
          </h2>
          <EventForm
            initialData={toEventRequest(event, enrichUpdates)}
            onSubmit={handleUpdate}
            onCancel={() => {
              setShowForm(false);
              setEnrichUpdates(null);
            }}
            mode="update"
            isSubmitting={addItem.isPending}
            submitLabel="Queue Update"
            initialVenue={event.venue}
            initialPromoter={event.promoter}
            initialTags={event.tags ?? []}
            initialEntities={event.entities ?? []}
          />
        </div>
      )}

      {!showForm && (
        <Button
          variant="outline"
          className="w-full"
          onClick={() => setShowForm(true)}
        >
          Edit Manually
        </Button>
      )}
    </div>
  );
}
