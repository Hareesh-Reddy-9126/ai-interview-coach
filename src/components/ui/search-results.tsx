"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Search, ArrowRight } from "lucide-react";

interface SearchResultsDropdownProps {
  searchOpen: boolean;
  search: string;
  searchResults: Array<{ to: string; label: string; description: string; icon: React.ReactNode }>;
  onSelect: (to: string) => void;
  onClose: () => void;
}

export function SearchResultsDropdown({
  searchOpen,
  search,
  searchResults,
  onSelect,
  onClose,
}: SearchResultsDropdownProps) {
  if (!searchOpen || !search.trim()) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -6, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -6, scale: 0.98 }}
        transition={{ duration: 0.15 }}
        className="absolute left-0 right-0 top-full mt-2 z-50"
      >
        <div className="overflow-hidden border border-[hsl(var(--surface-border))] bg-[hsl(var(--surface))]">
          {searchResults.length > 0 ? (
            searchResults.map((item) => (
              <button
                key={item.to}
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => { onSelect(item.to); onClose(); }}
                className="flex items-center gap-3 w-full px-4 py-3 border-t border-[hsl(var(--surface-border))/40] first:border-0 text-sm text-left text-muted-foreground hover:text-foreground hover:bg-[hsl(var(--surface-hover))] transition-all"
              >
                <span className="h-5 w-5 flex-shrink-0 flex items-center justify-center">
                  {item.icon}
                </span>
                <div className="flex-1 text-left">
                  <span className="block font-medium truncate">{item.label}</span>
                  <span className="text-[10px] text-muted-foreground/50 truncate block">{item.description}</span>
                </div>
                <ArrowRight className="h-4 w-4 ml-auto opacity-40" />
              </button>
            ))
          ) : (
            <div className="px-4 py-6 text-center">
              <Search className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground">No pages found for "{search}"</p>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}