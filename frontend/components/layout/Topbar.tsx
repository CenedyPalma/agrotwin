"use client";

import { Search, User, Menu, Leaf } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";
import { Input } from "@/components/ui/input";

export function Topbar({ onMenuClick }: { onMenuClick?: () => void }) {
  return (
    <header className="flex h-16 items-center justify-between gap-3 border-b border-border bg-surface px-3 sm:px-6">
      <div className="flex items-center gap-2.5 shrink-0">
        <button
          onClick={onMenuClick}
          aria-label="Open menu"
          className="md:hidden p-1.5 -ml-1 text-muted-foreground hover:text-foreground rounded-lg hover:bg-surface-2 transition-colors shrink-0"
        >
          <Menu size={22} />
        </button>
        <div className="flex items-center gap-2 md:hidden">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand text-white shadow-sm">
            <Leaf size={15} />
          </div>
          <span className="font-semibold text-sm tracking-tight">AgroTwin</span>
        </div>
      </div>

      <div className="relative flex-1 max-w-xs sm:max-w-sm hidden sm:block">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input type="text" placeholder="Search fields, surveys…" className="pl-9 h-9 text-sm" />
      </div>

      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        <ThemeToggle />
        <div className="text-right hidden sm:block">
          <div className="text-sm font-medium leading-tight">Farmer</div>
          <div className="text-xs text-muted-foreground leading-tight">Local MVP</div>
        </div>
        <div className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full bg-surface-2 border border-border">
          <User size={15} className="text-muted-foreground" />
        </div>
      </div>
    </header>
  );
}
