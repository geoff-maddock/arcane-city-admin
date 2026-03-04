"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { SmartEntitySelect } from "@/components/SmartEntitySelect";
import { SmartTagSelect } from "@/components/SmartTagSelect";
import { useEventTypes, useEventStatuses, useVisibilities } from "@/hooks/useApiData";
import {
  generateSlug,
  utcToLocalDatetimeInput,
  localDatetimeInputToUtc,
} from "@/lib/utils";
import type { EventRequest, EntityResponse, Tag } from "@/types/api";

interface EventFormProps {
  initialData?: Partial<EventRequest>;
  onSubmit: (data: EventRequest) => void;
  onCancel?: () => void;
  mode?: "create" | "update";
  isSubmitting?: boolean;
  submitLabel?: string;
  // Pre-populated entity/tag objects for display (when editing)
  initialVenue?: EntityResponse | null;
  initialPromoter?: EntityResponse | null;
  initialTags?: Tag[];
  initialEntities?: EntityResponse[];
}

export function EventForm({
  initialData,
  onSubmit,
  onCancel,
  mode = "create",
  isSubmitting = false,
  submitLabel,
  initialVenue,
  initialPromoter,
  initialTags = [],
  initialEntities = [],
}: EventFormProps) {
  const { data: eventTypesRes } = useEventTypes();
  const { data: eventStatusesRes } = useEventStatuses();
  const { data: visibilitiesRes } = useVisibilities();

  const eventTypes = eventTypesRes?.data ?? [];
  const eventStatuses = eventStatusesRes?.data ?? [];
  const visibilities = visibilitiesRes?.data ?? [];

  const [form, setForm] = useState<Partial<EventRequest>>({
    name: "",
    slug: "",
    start_at: "",
    event_type_id: 0,
    visibility_id: 0,
    is_benefit: false,
    do_not_repost: false,
    tag_list: [],
    entity_list: [],
    ...initialData,
  });

  const [autoSlug, setAutoSlug] = useState(mode === "create");
  const [selectedTags, setSelectedTags] = useState<Tag[]>(initialTags);
  const [selectedEntities, setSelectedEntities] = useState<EntityResponse[]>(initialEntities);

  // Set default visibility to Public once loaded
  useEffect(() => {
    if (visibilities.length > 0 && !form.visibility_id) {
      const publicVis =
        visibilities.find((v) => v.name.toLowerCase() === "public") ??
        visibilities[0];
      setForm((f) => ({ ...f, visibility_id: publicVis.id }));
    }
  }, [visibilities, form.visibility_id]);

  // Set default event status to active once loaded
  useEffect(() => {
    if (eventStatuses.length > 0 && !form.event_status_id) {
      const active =
        eventStatuses.find(
          (s) => s.name.toLowerCase().includes("active") || s.name.toLowerCase().includes("publish")
        ) ?? eventStatuses[0];
      setForm((f) => ({ ...f, event_status_id: active.id }));
    }
  }, [eventStatuses, form.event_status_id]);

  const set = <K extends keyof EventRequest>(key: K, value: EventRequest[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (key === "name" && autoSlug) {
      setForm((f) => ({ ...f, slug: generateSlug(String(value)) }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.slug || !form.start_at || !form.event_type_id || !form.visibility_id) {
      alert("Please fill in all required fields: name, slug, start date, event type, visibility.");
      return;
    }
    onSubmit(form as EventRequest);
  };

  const defaultSubmitLabel = mode === "create" ? "Add to Queue" : "Queue Update";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Identity */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Identity</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              value={form.name ?? ""}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Event name"
              required
            />
          </div>
          <div>
            <Label htmlFor="slug">
              Slug *{" "}
              <span className="text-muted-foreground font-normal text-xs">
                (URL identifier)
              </span>
            </Label>
            <div className="flex gap-2">
              <Input
                id="slug"
                value={form.slug ?? ""}
                onChange={(e) => {
                  setAutoSlug(false);
                  set("slug", e.target.value);
                }}
                placeholder="my-event-name"
                required
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setAutoSlug(true);
                  set("slug", generateSlug(form.name ?? ""));
                }}
              >
                Auto
              </Button>
            </div>
          </div>
          <div>
            <Label htmlFor="short">Tagline</Label>
            <Input
              id="short"
              value={form.short ?? ""}
              onChange={(e) => set("short", e.target.value)}
              placeholder="One-line description (max 255 chars)"
              maxLength={255}
            />
          </div>
        </CardContent>
      </Card>

      {/* Classification */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Classification</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="event_type_id">Event Type *</Label>
            <select
              id="event_type_id"
              className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={form.event_type_id ?? ""}
              onChange={(e) => set("event_type_id", Number(e.target.value))}
              required
            >
              <option value="">Select type...</option>
              {eventTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="event_status_id">Status</Label>
            <select
              id="event_status_id"
              className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={form.event_status_id ?? ""}
              onChange={(e) =>
                set("event_status_id", e.target.value ? Number(e.target.value) : null)
              }
            >
              <option value="">Select status...</option>
              {eventStatuses.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="visibility_id">Visibility *</Label>
            <select
              id="visibility_id"
              className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={form.visibility_id ?? ""}
              onChange={(e) => set("visibility_id", Number(e.target.value))}
              required
            >
              <option value="">Select...</option>
              {visibilities.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Dates */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Dates & Times</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="start_at">Start Date/Time *</Label>
            <Input
              id="start_at"
              type="datetime-local"
              value={utcToLocalDatetimeInput(form.start_at)}
              onChange={(e) =>
                set("start_at", localDatetimeInputToUtc(e.target.value) ?? "")
              }
              required
            />
          </div>
          <div>
            <Label htmlFor="door_at">Doors Open</Label>
            <Input
              id="door_at"
              type="datetime-local"
              value={utcToLocalDatetimeInput(form.door_at)}
              onChange={(e) =>
                set("door_at", localDatetimeInputToUtc(e.target.value))
              }
            />
          </div>
          <div>
            <Label htmlFor="end_at">End Time</Label>
            <Input
              id="end_at"
              type="datetime-local"
              value={utcToLocalDatetimeInput(form.end_at)}
              onChange={(e) =>
                set("end_at", localDatetimeInputToUtc(e.target.value))
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Venue & Promoter */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Venue & Promoter</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <SmartEntitySelect
            label="Venue"
            value={form.venue_id ?? null}
            onChange={(id) => set("venue_id", id)}
            entityType="Venue"
            placeholder="Search venues..."
            initialName={initialVenue?.name}
          />
          <SmartEntitySelect
            label="Promoter"
            value={form.promoter_id ?? null}
            onChange={(id) => set("promoter_id", id)}
            placeholder="Search promoters..."
            initialName={initialPromoter?.name}
          />
        </CardContent>
      </Card>

      {/* Pricing */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Pricing & Age</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="presale_price">Presale Price ($)</Label>
            <Input
              id="presale_price"
              type="number"
              step="0.01"
              min="0"
              value={form.presale_price ?? ""}
              onChange={(e) =>
                set("presale_price", e.target.value ? Number(e.target.value) : null)
              }
              placeholder="0.00"
            />
          </div>
          <div>
            <Label htmlFor="door_price">Door Price ($)</Label>
            <Input
              id="door_price"
              type="number"
              step="0.01"
              min="0"
              value={form.door_price ?? ""}
              onChange={(e) =>
                set("door_price", e.target.value ? Number(e.target.value) : null)
              }
              placeholder="0.00"
            />
          </div>
          <div>
            <Label htmlFor="min_age">Min Age</Label>
            <select
              id="min_age"
              className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={form.min_age ?? ""}
              onChange={(e) =>
                set("min_age", e.target.value !== "" ? Number(e.target.value) : null)
              }
            >
              <option value="">Not specified</option>
              <option value="0">All ages</option>
              <option value="18">18+</option>
              <option value="21">21+</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Links */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Links</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="primary_link">Primary Link</Label>
            <Input
              id="primary_link"
              type="url"
              value={form.primary_link ?? ""}
              onChange={(e) => set("primary_link", e.target.value || null)}
              placeholder="https://..."
            />
          </div>
          <div>
            <Label htmlFor="ticket_link">Ticket Link</Label>
            <Input
              id="ticket_link"
              type="url"
              value={form.ticket_link ?? ""}
              onChange={(e) => set("ticket_link", e.target.value || null)}
              placeholder="https://..."
            />
          </div>
        </CardContent>
      </Card>

      {/* Description */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Description</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={form.description ?? ""}
            onChange={(e) => set("description", e.target.value || null)}
            placeholder="Full event description..."
            rows={5}
          />
        </CardContent>
      </Card>

      {/* Tags & Entities */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Tags & Performers</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <SmartTagSelect
            label="Tags"
            value={form.tag_list ?? []}
            onChange={(ids, tags) => {
              set("tag_list", ids);
              setSelectedTags(tags);
            }}
            initialTags={selectedTags}
            placeholder="Search genres, styles, themes..."
          />

          <Separator />

          <div>
            <Label className="block text-sm font-medium mb-2">
              Related Entities (Performers, Artists)
            </Label>
            <div className="space-y-2">
              {selectedEntities.map((entity) => (
                <div key={entity.id} className="flex items-center gap-2">
                  <span className="text-sm">{entity.name}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => {
                      const updated = selectedEntities.filter((e) => e.id !== entity.id);
                      setSelectedEntities(updated);
                      set(
                        "entity_list",
                        updated.map((e) => e.id)
                      );
                    }}
                  >
                    ×
                  </Button>
                </div>
              ))}
              <SmartEntitySelect
                label=""
                value={null}
                onChange={(id, entity) => {
                  if (!id || !entity) return;
                  if (selectedEntities.some((e) => e.id === id)) return;
                  const updated = [...selectedEntities, entity];
                  setSelectedEntities(updated);
                  set(
                    "entity_list",
                    updated.map((e) => e.id)
                  );
                }}
                placeholder="Add performer or artist..."
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Flags */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Flags</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-6">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.is_benefit ?? false}
              onChange={(e) => set("is_benefit", e.target.checked)}
              className="rounded"
            />
            <span className="text-sm">Benefit event</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.do_not_repost ?? false}
              onChange={(e) => set("do_not_repost", e.target.checked)}
              className="rounded"
            />
            <span className="text-sm">Do not repost</span>
          </label>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-3">
        <Button type="submit" disabled={isSubmitting} className="flex-1">
          {isSubmitting ? "Processing..." : (submitLabel ?? defaultSubmitLabel)}
        </Button>
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
