"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Search, ExternalLink, ChevronRight, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatEventDate } from "@/lib/utils";
import type { EventResponse, PaginatedResponse } from "@/types/api";

export default function EventsPage() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  // Debounce
  const handleSearch = (val: string) => {
    setQuery(val);
    const t = setTimeout(() => setDebouncedQuery(val), 400);
    return () => clearTimeout(t);
  };

  const { data, isLoading, error } = useQuery<PaginatedResponse<EventResponse>>({
    queryKey: ["events", debouncedQuery],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (debouncedQuery) params.set("name", debouncedQuery);
      params.set("limit", "20");
      const res = await fetch(`/api/events?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load events");
      return res.json();
    },
    enabled: true,
  });

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Events</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Search and manage existing events
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search events by name..."
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
        />
      </div>

      {/* Results */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <Card>
          <CardContent className="py-8 text-center text-destructive text-sm">
            Failed to load events. Check your API connection in Settings.
          </CardContent>
        </Card>
      ) : data?.data.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground text-sm">
            No events found{debouncedQuery ? ` for "${debouncedQuery}"` : ""}.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {data?.data.map((event) => (
            <Link key={event.id} href={`/events/${event.slug}`}>
              <Card className="hover:border-primary/50 transition-colors cursor-pointer">
                <CardContent className="flex items-center gap-3 py-3 px-4">
                  {/* Flyer thumbnail */}
                  {event.primary_photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={event.primary_photo}
                      alt=""
                      className="h-12 w-12 rounded object-cover shrink-0"
                    />
                  ) : (
                    <div className="h-12 w-12 rounded bg-muted shrink-0" />
                  )}

                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{event.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {event.start_at ? formatEventDate(event.start_at) : "No date"}
                      {event.venue && ` · ${event.venue.name}`}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {event.event_type && (
                      <Badge variant="secondary" className="text-xs">
                        {event.event_type.name}
                      </Badge>
                    )}
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {data && data.total > data.data.length && (
        <p className="text-sm text-center text-muted-foreground">
          Showing {data.data.length} of {data.total} events.{" "}
          <a
            href="https://arcane.city/events"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline inline-flex items-center gap-1"
          >
            View all on arcane.city <ExternalLink className="h-3 w-3" />
          </a>
        </p>
      )}
    </div>
  );
}
