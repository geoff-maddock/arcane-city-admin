"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { QueueState, QueueItem } from "@/types/queue";

async function fetchQueue(): Promise<QueueState> {
  const res = await fetch("/api/queue");
  if (!res.ok) throw new Error("Failed to fetch queue");
  return res.json();
}

export function useQueue() {
  return useQuery<QueueState>({
    queryKey: ["queue"],
    queryFn: fetchQueue,
    refetchInterval: 3000,
  });
}

export function useQueueMutations() {
  const queryClient = useQueryClient();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["queue"] });

  const addItem = useMutation({
    mutationFn: async (
      item: Omit<QueueItem, "id" | "createdAt" | "updatedAt" | "status" | "retryCount">
    ) => {
      const res = await fetch("/api/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<QueueItem>;
    },
    onSuccess: invalidate,
  });

  const retryItem = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch("/api/queue", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "retry", id }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: invalidate,
  });

  const removeItem = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch("/api/queue", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "remove", id }),
      });
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: invalidate,
  });

  const clearCompleted = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/queue", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "clear_completed" }),
      });
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: invalidate,
  });

  const processQueue = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/queue", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "process" }),
      });
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: invalidate,
  });

  return { addItem, retryItem, removeItem, clearCompleted, processQueue };
}
