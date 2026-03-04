import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Convert UTC ISO string to a value suitable for datetime-local input (Eastern Time)
// The API stores UTC; inputs display in the user's local time (Eastern).
export function utcToLocalDatetimeInput(utcString: string | null | undefined): string {
  if (!utcString) return "";
  try {
    const date = new Date(utcString);
    if (isNaN(date.getTime())) return "";
    // Format as YYYY-MM-DDTHH:mm in local time
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  } catch {
    return "";
  }
}

// Convert datetime-local input value back to UTC ISO string for the API
export function localDatetimeInputToUtc(localString: string | null | undefined): string | null {
  if (!localString) return null;
  try {
    const date = new Date(localString);
    if (isNaN(date.getTime())) return null;
    return date.toISOString();
  } catch {
    return null;
  }
}

// Generate a URL slug from a name string
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

// Format a price number as a dollar string
export function formatPrice(price: number | null | undefined): string {
  if (price == null) return "";
  return `$${price.toFixed(2)}`;
}

// Format date for display
export function formatEventDate(dateString: string | null | undefined): string {
  if (!dateString) return "";
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return dateString;
  }
}
