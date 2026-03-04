"use client";

import { useQuery } from "@tanstack/react-query";
import { useState, useCallback, useRef } from "react";
import type {
  EventTypeResponse,
  EventStatusResponse,
  Visibility,
  EntityResponse,
  Tag,
  PaginatedResponse,
} from "@/types/api";

async function get<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fetch failed: ${url}`);
  return res.json();
}

export function useEventTypes() {
  return useQuery<PaginatedResponse<EventTypeResponse>>({
    queryKey: ["event-types"],
    queryFn: () => get("/api/event-types"),
    staleTime: 5 * 60 * 1000, // 5 min
  });
}

export function useEventStatuses() {
  return useQuery<PaginatedResponse<EventStatusResponse>>({
    queryKey: ["event-statuses"],
    queryFn: () => get("/api/event-statuses"),
    staleTime: 5 * 60 * 1000,
  });
}

export function useVisibilities() {
  return useQuery<PaginatedResponse<Visibility>>({
    queryKey: ["visibilities"],
    queryFn: () => get("/api/visibilities"),
    staleTime: 5 * 60 * 1000,
  });
}

// Debounced entity search hook
export function useEntitySearch(entityType?: string, entityRole?: string) {
  const [results, setResults] = useState<EntityResponse[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(
    (query: string) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (!query.trim()) {
        setResults([]);
        return;
      }
      timerRef.current = setTimeout(async () => {
        setIsLoading(true);
        try {
          const params = new URLSearchParams({ name: query, limit: "20" });
          if (entityType) params.set("entity_type", entityType);
          if (entityRole) params.set("role", entityRole);
          const data: PaginatedResponse<EntityResponse> = await get(
            `/api/entities?${params.toString()}`
          );
          setResults(data.data);
        } catch {
          setResults([]);
        } finally {
          setIsLoading(false);
        }
      }, 300);
    },
    [entityType, entityRole]
  );

  return { results, isLoading, search };
}

// Debounced tag search hook
export function useTagSearch() {
  const [results, setResults] = useState<Tag[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback((query: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!query.trim()) {
      setResults([]);
      return;
    }
    timerRef.current = setTimeout(async () => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams({ name: query, limit: "20" });
        const data: PaginatedResponse<Tag> = await get(
          `/api/tags?${params.toString()}`
        );
        setResults(data.data);
      } catch {
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, 300);
  }, []);

  return { results, isLoading, search };
}
