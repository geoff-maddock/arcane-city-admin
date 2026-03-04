import { NextRequest, NextResponse } from "next/server";
import { analyzeFlyer } from "@/lib/claude";
import type { AnalysisResponse } from "@/types/llm";

// POST multipart/form-data: { image: File, context?: string }
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const imageFile = formData.get("image") as File | null;
    const context = (formData.get("context") as string) || undefined;

    if (!imageFile) {
      return NextResponse.json(
        { success: false, error: "No image provided" },
        { status: 400 }
      );
    }

    const mimeType = imageFile.type as
      | "image/jpeg"
      | "image/png"
      | "image/webp"
      | "image/gif";

    if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(mimeType)) {
      return NextResponse.json(
        { success: false, error: "Unsupported image type. Use JPEG, PNG, WebP, or GIF." },
        { status: 400 }
      );
    }

    const arrayBuffer = await imageFile.arrayBuffer();
    const imageBase64 = Buffer.from(arrayBuffer).toString("base64");

    const extracted = await analyzeFlyer({ imageBase64, mimeType, additionalContext: context });

    const response: AnalysisResponse = { success: true, extracted };
    return NextResponse.json(response);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Analysis failed";
    console.error("[analyze]", err);
    const response: AnalysisResponse = { success: false, error: msg };
    return NextResponse.json(response, { status: 500 });
  }
}
