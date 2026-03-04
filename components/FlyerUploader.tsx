"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { UploadCloud, X, Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export interface FlyerFile {
  file: File;
  previewUrl: string;
  dataUrl: string; // base64 for API submission
  compressed?: boolean; // true if downscaled/converted before submission
}

interface FlyerUploaderProps {
  onFilesReady: (files: FlyerFile[]) => void;
  maxFiles?: number;
  disabled?: boolean;
}

export function FlyerUploader({
  onFilesReady,
  maxFiles = 5,
  disabled = false,
}: FlyerUploaderProps) {
  const [pendingFiles, setPendingFiles] = useState<FlyerFile[]>([]);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const newFiles = await Promise.all(
        acceptedFiles.slice(0, maxFiles).map(async (file) => {
          const { dataUrl, compressed } = await prepareDataUrl(file);
          return {
            file,
            previewUrl: URL.createObjectURL(file),
            dataUrl,
            compressed,
          };
        })
      );
      const updated = [...pendingFiles, ...newFiles].slice(0, maxFiles);
      setPendingFiles(updated);
      onFilesReady(updated);
    },
    [pendingFiles, maxFiles, onFilesReady]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [".jpg", ".jpeg", ".png", ".webp", ".gif"] },
    maxFiles,
    disabled,
  });

  const removeFile = (idx: number) => {
    const updated = pendingFiles.filter((_, i) => i !== idx);
    URL.revokeObjectURL(pendingFiles[idx].previewUrl);
    setPendingFiles(updated);
    onFilesReady(updated);
  };

  return (
    <div className="space-y-3">
      <div
        {...getRootProps()}
        className={cn(
          "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
          isDragActive
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-primary/50",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        <input {...getInputProps()} />
        <UploadCloud className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
        {isDragActive ? (
          <p className="text-primary font-medium">Drop flyers here...</p>
        ) : (
          <>
            <p className="font-medium">Drag & drop flyers here</p>
            <p className="text-sm text-muted-foreground mt-1">
              or click to select — JPEG, PNG, WebP, GIF (up to {maxFiles})
            </p>
          </>
        )}
      </div>

      {pendingFiles.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {pendingFiles.map((f, idx) => (
            <div key={idx} className="relative group rounded-lg overflow-hidden border bg-muted aspect-square">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={f.previewUrl}
                alt={f.file.name}
                className="w-full h-full object-contain"
              />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Button
                  variant="destructive"
                  size="icon"
                  className="h-7 w-7"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile(idx);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-2 py-1 flex items-center gap-1.5">
                <p className="text-white text-xs truncate flex-1">{f.file.name}</p>
                {f.compressed && (
                  <span className="text-xs bg-yellow-500/80 text-black px-1 rounded shrink-0">
                    compressed
                  </span>
                )}
              </div>
            </div>
          ))}
          {pendingFiles.length < maxFiles && (
            <div
              {...getRootProps()}
              className="border-2 border-dashed rounded-lg aspect-square flex flex-col items-center justify-center cursor-pointer text-muted-foreground hover:border-primary/50 transition-colors"
            >
              <input {...getInputProps()} />
              <ImageIcon className="h-6 w-6 mb-1" />
              <span className="text-xs">Add more</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const COMPRESS_THRESHOLD = 5 * 1024 * 1024; // 5MB
const MAX_DIM = 2048;
const WEBP_QUALITY = 0.85;

async function prepareDataUrl(file: File): Promise<{ dataUrl: string; compressed: boolean }> {
  if (file.size <= COMPRESS_THRESHOLD) {
    const dataUrl = await fileToDataUrl(file);
    return { dataUrl, compressed: false };
  }

  const bitmap = await createImageBitmap(file);
  const { width, height } = bitmap;

  let newWidth = width;
  let newHeight = height;
  if (width > MAX_DIM || height > MAX_DIM) {
    const scale = Math.min(MAX_DIM / width, MAX_DIM / height);
    newWidth = Math.round(width * scale);
    newHeight = Math.round(height * scale);
  }

  const canvas = document.createElement("canvas");
  canvas.width = newWidth;
  canvas.height = newHeight;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, newWidth, newHeight);
  bitmap.close();

  return { dataUrl: canvas.toDataURL("image/webp", WEBP_QUALITY), compressed: true };
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
