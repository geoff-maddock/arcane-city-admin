"use client";

import { useState, useRef, useEffect } from "react";
import { Search, X, ChevronDown } from "lucide-react";
import { useEntitySearch } from "@/hooks/useApiData";
import { cn } from "@/lib/utils";
import type { EntityResponse } from "@/types/api";

interface SmartEntitySelectProps {
  value: number | null;
  onChange: (id: number | null, entity: EntityResponse | null) => void;
  entityType?: string; // "Venue", "Individual", "Group"
  placeholder?: string;
  label?: string;
  initialName?: string; // Pre-populate display when editing
}

export function SmartEntitySelect({
  value,
  onChange,
  entityType,
  placeholder = "Search...",
  label,
  initialName,
}: SmartEntitySelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(initialName || "");
  const [selectedName, setSelectedName] = useState(initialName || "");
  const { results, isLoading, search } = useEntitySearch(entityType);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        if (!value) setQuery("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open, value]);

  const handleInputChange = (q: string) => {
    setQuery(q);
    search(q);
    if (!open) setOpen(true);
  };

  const handleSelect = (entity: EntityResponse) => {
    setSelectedName(entity.name);
    setQuery(entity.name);
    onChange(entity.id, entity);
    setOpen(false);
  };

  const handleClear = () => {
    setQuery("");
    setSelectedName("");
    onChange(null, null);
    inputRef.current?.focus();
  };

  return (
    <div className="relative" ref={containerRef}>
      {label && (
        <label className="block text-sm font-medium mb-1">{label}</label>
      )}
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
        {value ? (
          <button
            type="button"
            onClick={handleClear}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </div>

      {open && (
        <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-md max-h-60 overflow-y-auto">
          {isLoading ? (
            <div className="px-3 py-2 text-sm text-muted-foreground">Searching...</div>
          ) : results.length === 0 ? (
            <div className="px-3 py-2 text-sm text-muted-foreground">
              {query.length > 0 ? "No results found" : "Type to search"}
            </div>
          ) : (
            results.map((entity) => (
              <button
                key={entity.id}
                type="button"
                className={cn(
                  "w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors",
                  value === entity.id && "bg-accent font-medium"
                )}
                onClick={() => handleSelect(entity)}
              >
                <div className="font-medium">{entity.name}</div>
                {entity.entity_type && (
                  <div className="text-xs text-muted-foreground">
                    {entity.entity_type.name}
                  </div>
                )}
              </button>
            ))
          )}
        </div>
      )}

      {value && selectedName && (
        <p className="text-xs text-muted-foreground mt-1">
          ID: {value} — {selectedName}
        </p>
      )}
    </div>
  );
}
