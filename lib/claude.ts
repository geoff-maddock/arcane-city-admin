import Anthropic from "@anthropic-ai/sdk";
import type { ExtractedEventData, LLMMatchResult } from "@/types/llm";
import type {
  EntityResponse,
  Tag,
  EventTypeResponse,
  EventStatusResponse,
  Visibility,
  EventResponse,
} from "@/types/api";
import {
  buildExtractionSystemPrompt,
  buildExtractionUserPrompt,
  buildMatchingPrompt,
  buildEnrichmentPrompt,
} from "./prompts";
import type { EventRequest } from "@/types/api";

function getClient(): Anthropic {
  return new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    maxRetries: 3,
    timeout: 60000,
  });
}

function parseJsonResponse(text: string): unknown {
  // Strip any accidental markdown fences
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  return JSON.parse(cleaned);
}

// Analyze a flyer image and extract structured event data
export async function analyzeFlyer(params: {
  imageBase64: string;
  mimeType: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
  additionalContext?: string;
}): Promise<ExtractedEventData> {
  const message = await getClient().messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    system: buildExtractionSystemPrompt(),
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: params.mimeType,
              data: params.imageBase64,
            },
          },
          {
            type: "text",
            text: buildExtractionUserPrompt(params.additionalContext),
          },
        ],
      },
    ],
  });

  const textBlock = message.content.find((c) => c.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from Claude");
  }
  return parseJsonResponse(textBlock.text) as ExtractedEventData;
}

// Match extracted event data against API reference data to resolve IDs
export async function matchExtractedData(params: {
  extracted: ExtractedEventData;
  entities: EntityResponse[];
  tags: Tag[];
  eventTypes: EventTypeResponse[];
  eventStatuses: EventStatusResponse[];
  visibilities: Visibility[];
}): Promise<LLMMatchResult> {
  const message = await getClient().messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: buildMatchingPrompt(params),
      },
    ],
  });

  const textBlock = message.content.find((c) => c.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from Claude");
  }
  return parseJsonResponse(textBlock.text) as LLMMatchResult;
}

// Determine what fields to update for an existing event
export async function enrichEvent(params: {
  existingEvent: EventResponse;
  additionalInfo: string;
  availableEntities?: EntityResponse[];
  availableTags?: Tag[];
}): Promise<Partial<EventRequest>> {
  const message = await getClient().messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: buildEnrichmentPrompt(params),
      },
    ],
  });

  const textBlock = message.content.find((c) => c.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from Claude");
  }
  return parseJsonResponse(textBlock.text) as Partial<EventRequest>;
}
