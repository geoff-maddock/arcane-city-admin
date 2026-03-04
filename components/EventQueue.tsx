"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { CheckCircle2, ChevronRight, Clock, Loader2, XCircle, RefreshCw, Trash2, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQueue, useQueueMutations } from "@/hooks/useQueue";
import type { QueueItem, QueueItemStatus } from "@/types/queue";
import { cn } from "@/lib/utils";

const STATUS_CONFIG: Record<
  QueueItemStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ComponentType<{ className?: string }> }
> = {
  pending: { label: "Pending", variant: "secondary", icon: Clock },
  processing: { label: "Processing", variant: "default", icon: Loader2 },
  completed: { label: "Done", variant: "outline", icon: CheckCircle2 },
  failed: { label: "Failed", variant: "destructive", icon: XCircle },
};

function QueueItemRow({ item }: { item: QueueItem }) {
  const [logsOpen, setLogsOpen] = useState(false);
  const { retryItem, removeItem } = useQueueMutations();
  const config = STATUS_CONFIG[item.status];
  const Icon = config.icon;
  const eventUrl = item.result?.eventSlug
    ? `https://arcane.city/events/${item.result.eventSlug}`
    : null;

  return (
    <div className={cn(
      "flex items-start gap-3 p-3 rounded-lg border transition-colors",
      item.status === "processing" && "bg-primary/5 border-primary/20",
      item.status === "completed" && "bg-green-500/5 border-green-500/20 opacity-75",
      item.status === "failed" && "bg-destructive/5 border-destructive/20",
    )}>
      {/* Status icon */}
      <Icon
        className={cn(
          "h-5 w-5 shrink-0 mt-0.5",
          item.status === "processing" && "animate-spin text-primary",
          item.status === "completed" && "text-green-500",
          item.status === "failed" && "text-destructive",
          item.status === "pending" && "text-muted-foreground",
        )}
      />

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-medium text-sm truncate">{item.label}</p>
          <Badge variant={config.variant} className="text-xs shrink-0">
            {config.label}
          </Badge>
          <Badge variant="outline" className="text-xs shrink-0">
            {item.action}
          </Badge>
        </div>

        <p className="text-xs text-muted-foreground mt-0.5">
          {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
          {item.retryCount > 0 && ` · ${item.retryCount} retries`}
        </p>

        {item.result?.error && (
          <p className="text-xs text-destructive mt-1 font-mono bg-destructive/10 px-2 py-1 rounded">
            {item.result.error}
          </p>
        )}

        {item.logs && item.logs.length > 0 && (
          <div className="mt-1.5">
            <button
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setLogsOpen((o) => !o)}
            >
              <ChevronRight className={cn("h-3 w-3 transition-transform", logsOpen && "rotate-90")} />
              {item.logs.length} request{item.logs.length !== 1 ? "s" : ""}
            </button>
            {logsOpen && (
              <div className="mt-1 space-y-1.5">
                {item.logs.map((log, i) => (
                  <div key={i} className="text-xs font-mono bg-muted rounded px-2 py-1.5 space-y-0.5">
                    <div className="font-semibold break-all">{log.method} {log.url}</div>
                    {log.requestBody !== undefined && (
                      <pre className="text-muted-foreground overflow-x-auto whitespace-pre-wrap break-all">
                        {JSON.stringify(log.requestBody, null, 2)}
                      </pre>
                    )}
                    <div className={cn(
                      "font-semibold",
                      log.status && log.status >= 400 ? "text-destructive" : "text-green-600 dark:text-green-400"
                    )}>
                      ← {log.status ? `HTTP ${log.status}` : "no response"}{log.error ? ` — ${log.error}` : ""}
                    </div>
                    {log.responseBody !== undefined && (
                      <pre className="text-muted-foreground overflow-x-auto whitespace-pre-wrap break-all">
                        {JSON.stringify(log.responseBody, null, 2)}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        {eventUrl && (
          <Button asChild variant="ghost" size="icon" className="h-7 w-7">
            <a href={eventUrl} target="_blank" rel="noopener noreferrer" title="View on arcane.city">
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </Button>
        )}
        {item.status === "failed" && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => retryItem.mutate(item.id)}
            title="Retry"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        )}
        {(item.status === "completed" || item.status === "failed") && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
            onClick={() => removeItem.mutate(item.id)}
            title="Remove"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}

export function EventQueue() {
  const { data, isLoading } = useQueue();
  const { clearCompleted, processQueue } = useQueueMutations();

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const items = data?.items ?? [];
  const pending = items.filter((i) => i.status === "pending");
  const processing = items.filter((i) => i.status === "processing");
  const completed = items.filter((i) => i.status === "completed");
  const failed = items.filter((i) => i.status === "failed");

  const sortedItems = [
    ...processing,
    ...pending,
    ...failed,
    ...completed,
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            Event Queue
            {data?.isProcessing && (
              <Badge variant="default" className="text-xs">
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
                Processing
              </Badge>
            )}
          </CardTitle>
          <div className="flex gap-2">
            {pending.length > 0 && !data?.isProcessing && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => processQueue.mutate()}
              >
                Process Queue
              </Button>
            )}
            {(completed.length > 0 || failed.length > 0) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => clearCompleted.mutate()}
              >
                Clear Done
              </Button>
            )}
          </div>
        </div>

        {/* Summary stats */}
        <div className="flex gap-4 text-sm text-muted-foreground">
          {pending.length > 0 && <span>{pending.length} pending</span>}
          {processing.length > 0 && <span className="text-primary">{processing.length} processing</span>}
          {failed.length > 0 && <span className="text-destructive">{failed.length} failed</span>}
          {completed.length > 0 && <span className="text-green-600">{completed.length} done</span>}
          {items.length === 0 && <span>Queue is empty</span>}
        </div>
      </CardHeader>

      {sortedItems.length > 0 && (
        <CardContent className="space-y-2">
          {sortedItems.map((item) => (
            <QueueItemRow key={item.id} item={item} />
          ))}
        </CardContent>
      )}
    </Card>
  );
}
