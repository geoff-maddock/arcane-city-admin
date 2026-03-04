"use client";

import { useState, useRef, useEffect } from "react";
import { Search, X, Tag as TagIcon } from "lucide-react";
import { useTagSearch } from "@/hooks/useApiData";
import { cn } from "@/lib/utils";
import type { Tag } from "@/types/api";

interface SmartTagSelectProps {
  value: number[]; // array of selected tag IDs
  onChange: (ids: number[], tags: Tag[]) => void;
  placeholder?: string;
  label?: string;
  initialTags?: Tag[]; // Pre-populate when editing
}

export function SmartTagSelect({
  value,
  onChange,
  placeholder = "Search tags...",
  label,
  initialTags = [],
}: SmartTagSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedTags, setSelectedTags] = useState<Tag[]>(initialTags);
  const { results, isLoading, search } = useTagSearch();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync selectedTags when value changes externally
  useEffect(() => {
    if (initialTags.length > 0 && selectedTags.length === 0) {
      setSelectedTags(initialTags);
    }
  }, [initialTags, selectedTags.length]);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const handleInputChange = (q: string) => {
    setQuery(q);
    search(q);
    if (!open) setOpen(true);
  };

  const addTag = (tag: Tag) => {
    if (value.includes(tag.id)) return;
    const updated = [...selectedTags, tag];
    setSelectedTags(updated);
    onChange(
      updated.map((t) => t.id),
      updated
    );
    setQuery("");
    inputRef.current?.focus();
  };

  const removeTag = (tagId: number) => {
    const updated = selectedTags.filter((t) => t.id !== tagId);
    setSelectedTags(updated);
    onChange(
      updated.map((t) => t.id),
      updated
    );
  };

  const filteredResults = results.filter((t) => !value.includes(t.id));

  return (
    <div className="space-y-2" ref={containerRef}>
      {label && (
        <label className="block text-sm font-medium">{label}</label>
      )}

      {/* Selected tags */}
      {selectedTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedTags.map((tag) => (
            <span
              key={tag.id}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium"
            >
              <TagIcon className="h-3 w-3" />
              {tag.name}
              <button
                type="button"
                onClick={() => removeTag(tag.id)}
                className="hover:text-destructive ml-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Search input */}
      <div className="relative">
        <div
          className={cn(
            "flex items-center border rounded-md bg-background px-3 h-10 gap-2",
            open ? "ring-2 ring-ring" : "border-input"
          )}
        >
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            placeholder={placeholder}
            value={query}
            onChange={(e) => handleInputChange(e.target.value)}
            onFocus={() => {
              setOpen(true);
              if (query) search(query);
            }}
          />
        </div>

        {open && (
          <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-md max-h-48 overflow-y-auto">
            {isLoading ? (
              <div className="px-3 py-2 text-sm text-muted-foreground">Searching...</div>
            ) : filteredResults.length === 0 ? (
              <div className="px-3 py-2 text-sm text-muted-foreground">
                {query.length > 0 ? "No tags found" : "Type to search tags"}
              </div>
            ) : (
              filteredResults.map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors flex items-center gap-2"
                  onClick={() => addTag(tag)}
                >
                  <TagIcon className="h-3 w-3 text-muted-foreground" />
                  {tag.name}
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
