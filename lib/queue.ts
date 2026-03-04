import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { v4 as uuidv4 } from "uuid";
import type { QueueItem, QueueState, QueueItemAction, RequestLog } from "@/types/queue";
import type { EventRequest } from "@/types/api";

const QUEUE_FILE = join(process.cwd(), "data", "queue.json");

// In-memory singleton for the running process
let queueState: QueueState = {
  items: [],
  isProcessing: false,
  lastProcessedAt: null,
};

let initialized = false;

export function initQueue(): void {
  if (initialized) return;
  initialized = true;

  // Ensure data directory exists
  const dataDir = join(process.cwd(), "data");
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }

  if (existsSync(QUEUE_FILE)) {
    try {
      const raw = readFileSync(QUEUE_FILE, "utf-8");
      const saved = JSON.parse(raw) as QueueState;
      // Reset any stuck "processing" items back to pending on restart
      saved.items = saved.items.map((item) =>
        item.status === "processing" ? { ...item, status: "pending" } : item
      );
      saved.isProcessing = false;
      queueState = saved;
    } catch {
      // Corrupted file, start fresh
      queueState = { items: [], isProcessing: false, lastProcessedAt: null };
    }
  }
}

function persist(): void {
  try {
    writeFileSync(QUEUE_FILE, JSON.stringify(queueState, null, 2), "utf-8");
  } catch (err) {
    console.error("[queue] Failed to persist:", err);
  }
}

export function getQueueState(): QueueState {
  initQueue();
  return queueState;
}

export function addToQueue(
  item: Omit<QueueItem, "id" | "createdAt" | "updatedAt" | "status" | "retryCount">
): QueueItem {
  initQueue();
  const newItem: QueueItem = {
    ...item,
    id: uuidv4(),
    status: "pending",
    retryCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  queueState.items.push(newItem);
  persist();
  // Kick off processing if not already running
  setImmediate(() => processQueue());
  return newItem;
}

export function updateQueueItem(
  id: string,
  updates: Partial<QueueItem>
): QueueItem | null {
  initQueue();
  const idx = queueState.items.findIndex((i) => i.id === id);
  if (idx === -1) return null;
  queueState.items[idx] = {
    ...queueState.items[idx],
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  persist();
  return queueState.items[idx];
}

export function removeQueueItem(id: string): boolean {
  initQueue();
  const idx = queueState.items.findIndex((i) => i.id === id);
  if (idx === -1) return false;
  queueState.items.splice(idx, 1);
  persist();
  return true;
}

export function clearCompleted(): void {
  initQueue();
  queueState.items = queueState.items.filter(
    (i) => i.status !== "completed" && i.status !== "failed"
  );
  persist();
}

export async function processQueue(): Promise<void> {
  initQueue();
  if (queueState.isProcessing) return;

  const next = queueState.items.find((i) => i.status === "pending");
  if (!next) return;

  queueState.isProcessing = true;
  updateQueueItem(next.id, { status: "processing" });

  const { setActiveLogs } = await import("./arcane-api");
  const logs: RequestLog[] = [];
  setActiveLogs(logs);

  try {
    await processItem(next);
    // Clear large binary data after successful processing
    updateQueueItem(next.id, {
      status: "completed",
      logs,
      photoFile: next.photoFile
        ? { ...next.photoFile, dataUrl: "" }
        : undefined,
    });
    queueState.lastProcessedAt = new Date().toISOString();
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    const retryCount = next.retryCount + 1;
    if (retryCount <= next.maxRetries) {
      updateQueueItem(next.id, {
        status: "pending",
        retryCount,
        logs,
        result: { error: `Retry ${retryCount}: ${errorMsg}` },
      });
    } else {
      updateQueueItem(next.id, {
        status: "failed",
        logs,
        result: { error: errorMsg },
      });
    }
  } finally {
    setActiveLogs(null);
    queueState.isProcessing = false;
    persist();
    // Auto-continue to next pending item
    const hasMore = queueState.items.some((i) => i.status === "pending");
    if (hasMore) {
      setImmediate(() => processQueue());
    }
  }
}

async function processItem(item: QueueItem): Promise<void> {
  const { arcaneApi } = await import("./arcane-api");

  if (item.action === "create" && item.eventData) {
    const created = await arcaneApi.createEvent(item.eventData as EventRequest);
    updateQueueItem(item.id, {
      result: { eventId: created.id, eventSlug: created.slug },
    });
    // Upload flyer photo if present
    if (item.photoFile?.dataUrl && created.id) {
      await arcaneApi.uploadEventPhoto(created.id, item.photoFile);
    }
  } else if (item.action === "update" && item.eventSlug && item.eventData) {
    const updated = await arcaneApi.updateEvent(item.eventSlug, item.eventData);
    updateQueueItem(item.id, {
      result: { eventId: updated.id, eventSlug: updated.slug },
    });
  } else if (
    item.action === "upload_photo" &&
    item.photoEventId &&
    item.photoFile?.dataUrl
  ) {
    await arcaneApi.uploadEventPhoto(item.photoEventId, item.photoFile);
  } else {
    throw new Error(`Invalid queue item: action=${item.action}`);
  }
}

// Helper to build a queue item for creating an event
export function buildCreateItem(params: {
  eventData: EventRequest;
  photoFile?: QueueItem["photoFile"];
  flyerDataUrl?: string;
  label?: string;
  maxRetries?: number;
}): Omit<QueueItem, "id" | "createdAt" | "updatedAt" | "status" | "retryCount"> {
  return {
    action: "create" as QueueItemAction,
    label: params.label || params.eventData.name,
    eventData: params.eventData,
    photoFile: params.photoFile,
    flyerDataUrl: params.flyerDataUrl,
    maxRetries: params.maxRetries ?? 2,
  };
}

// Helper to build a queue item for updating an event
export function buildUpdateItem(params: {
  eventSlug: string;
  eventData: Partial<EventRequest>;
  label?: string;
  maxRetries?: number;
}): Omit<QueueItem, "id" | "createdAt" | "updatedAt" | "status" | "retryCount"> {
  return {
    action: "update" as QueueItemAction,
    label: params.label || `Update: ${params.eventSlug}`,
    eventSlug: params.eventSlug,
    eventData: params.eventData as EventRequest,
    maxRetries: params.maxRetries ?? 2,
  };
}
