import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { Database } from "@/integrations/supabase/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Returns a user-facing message from an unknown thrown value. */
export function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  if (typeof error === "string" && error.trim()) return error;
  return fallback;
}

export type UserAnalytics = Database["public"]["Tables"]["user_analytics"]["Row"];

export interface ResumeContext {
  skills?: string[];
  technologies?: string[];
  projects?: string[];
  experience?: string[];
}
