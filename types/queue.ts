import type { EventRequest } from "./api";

export type QueueItemStatus = "pending" | "processing" | "completed" | "failed";
export type QueueItemAction = "create" | "update" | "upload_photo";

export interface RequestLog {
  ts: string;
  method: string;
  url: string;
  requestBody?: unknown;
  status?: number;
  responseBody?: unknown;
  error?: string;
}

export interface QueueItemPhoto {
  name: string;
  dataUrl: string; // base64 for persistence; cleared after successful upload
  mimeType: string;
}

export interface QueueItem {
  id: string; // UUID
  action: QueueItemAction;
  status: QueueItemStatus;
  label: string; // Human-readable name
  // For create/update
  eventData?: EventRequest;
  // For update: slug of the existing event
  eventSlug?: string;
  // For photo upload: event integer id (NOT slug)
  photoEventId?: number;
  photoFile?: QueueItemPhoto;
  // Flyer preview URL (data URL, display only)
  flyerDataUrl?: string;
  // Processing result
  result?: {
    eventId?: number;
    eventSlug?: string;
    error?: string;
  };
  // Request/response log for the most recent processing attempt
  logs?: RequestLog[];
  retryCount: number;
  maxRetries: number;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

export interface QueueState {
  items: QueueItem[];
  isProcessing: boolean;
  lastProcessedAt: string | null;
}
