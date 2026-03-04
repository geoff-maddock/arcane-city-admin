import { NextRequest, NextResponse } from "next/server";
import {
  getQueueState,
  addToQueue,
  updateQueueItem,
  removeQueueItem,
  clearCompleted,
  processQueue,
} from "@/lib/queue";

export async function GET() {
  try {
    const state = getQueueState();
    return NextResponse.json(state);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to get queue";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const item = addToQueue(body);
    return NextResponse.json(item, { status: 201 });
  } catch (err: unknown) {
    const msg =
      err instanceof Error ? err.message : "Failed to add queue item";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, id, updates } = body as {
      action: string;
      id?: string;
      updates?: Record<string, unknown>;
    };

    if (action === "process") {
      // Manually trigger queue processing
      processQueue(); // Fire and forget
      return NextResponse.json({ ok: true });
    }

    if (action === "update" && id && updates) {
      const item = updateQueueItem(id, updates);
      if (!item) {
        return NextResponse.json({ error: "Item not found" }, { status: 404 });
      }
      return NextResponse.json(item);
    }

    if (action === "remove" && id) {
      const ok = removeQueueItem(id);
      return NextResponse.json({ ok });
    }

    if (action === "retry" && id) {
      const item = updateQueueItem(id, { status: "pending", retryCount: 0 });
      if (!item) {
        return NextResponse.json({ error: "Item not found" }, { status: 404 });
      }
      processQueue(); // Fire and forget
      return NextResponse.json(item);
    }

    if (action === "clear_completed") {
      clearCompleted();
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err: unknown) {
    const msg =
      err instanceof Error ? err.message : "Failed to update queue";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
