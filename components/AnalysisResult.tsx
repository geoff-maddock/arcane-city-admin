"use client";

import { CheckCircle2, AlertCircle, HelpCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { ExtractedEventData } from "@/types/llm";

interface AnalysisResultProps {
  extracted: ExtractedEventData;
}

function ConfidenceBadge({ score }: { score?: number }) {
  if (score === undefined) return null;
  const pct = Math.round(score * 100);
  const variant =
    pct >= 80 ? "outline" : pct >= 50 ? "secondary" : "destructive";
  const Icon = pct >= 80 ? CheckCircle2 : pct >= 50 ? HelpCircle : AlertCircle;
  return (
    <Badge variant={variant} className="text-xs gap-1">
      <Icon className="h-3 w-3" />
      {pct}%
    </Badge>
  );
}

function Row({ label, value, confidence }: { label: string; value: string | undefined | null; confidence?: number }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2 py-1">
      <span className="text-sm text-muted-foreground w-32 shrink-0">{label}</span>
      <span className="text-sm flex-1">{value}</span>
      <ConfidenceBadge score={confidence} />
    </div>
  );
}

export function AnalysisResult({ extracted }: AnalysisResultProps) {
  const c = extracted.confidence;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          Extracted Data
          <Badge variant="secondary" className="text-xs">Review before confirming</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        <Row label="Event Name" value={extracted.name} confidence={c?.name} />
        <Row label="Date (raw)" value={extracted.date_text} />
        <Row label="Start (UTC)" value={extracted.start_at_parsed} confidence={c?.dates} />
        <Row label="Door Time" value={extracted.door_at_parsed} />
        <Row label="End Time" value={extracted.end_at_parsed} />
        <Row label="Venue" value={extracted.venue_name} confidence={c?.venue} />
        <Row label="Promoter" value={extracted.promoter_name} />
        <Row
          label="Prices"
          value={[
            extracted.presale_price != null ? `$${extracted.presale_price} adv` : null,
            extracted.door_price != null ? `$${extracted.door_price} door` : null,
          ]
            .filter(Boolean)
            .join(" / ")}
          confidence={c?.prices}
        />
        <Row
          label="Age"
          value={
            extracted.min_age === 0
              ? "All ages"
              : extracted.min_age != null
              ? `${extracted.min_age}+`
              : undefined
          }
        />
        <Row label="Event Type" value={extracted.event_type_raw} />

        {extracted.tags_raw && extracted.tags_raw.length > 0 && (
          <>
            <Separator className="my-2" />
            <div className="py-1">
              <p className="text-sm text-muted-foreground mb-1.5">Tags extracted</p>
              <div className="flex flex-wrap gap-1.5">
                {extracted.tags_raw.map((tag, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          </>
        )}

        {extracted.entities_raw && extracted.entities_raw.length > 0 && (
          <>
            <Separator className="my-2" />
            <div className="py-1">
              <p className="text-sm text-muted-foreground mb-1.5">Performers/Artists</p>
              <div className="flex flex-wrap gap-1.5">
                {extracted.entities_raw.map((name, i) => (
                  <Badge key={i} variant="outline" className="text-xs">
                    {name}
                  </Badge>
                ))}
              </div>
            </div>
          </>
        )}

        {extracted.notes && (
          <>
            <Separator className="my-2" />
            <div className="py-1">
              <p className="text-sm text-muted-foreground mb-1">Notes from analysis</p>
              <p className="text-sm italic text-muted-foreground">{extracted.notes}</p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
