"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type ActionItem<T> = {
  label: string;
  icon?: LucideIcon;
  onClick: (row: T) => void;
  disabled?: boolean;
  variant?: "default" | "destructive";
};

type ActionsCellProps<T> = {
  row: T;
  actions: ActionItem<T>[];
  "aria-label"?: string;
};

/**
 * Renders a single trigger button that opens a dropdown list of actions.
 * Use in DataGrid action columns for consistent alignment and UX.
 */
export function ActionsCell<T>({
  row,
  actions,
  "aria-label": ariaLabel = "Actions",
}: ActionsCellProps<T>) {
  const visibleActions = actions.filter((a) => a !== undefined);
  if (visibleActions.length === 0) return null;

  return (
    <div className="flex items-center justify-center w-full h-full min-h-[52px]">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-slate-400 hover:text-white"
            aria-label={ariaLabel}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-48 border-white/10 bg-space-800 text-slate-200"
        >
          {visibleActions.map((action, idx) => {
            const Icon = action.icon;
            const isDestructive = action.variant === "destructive";
            return (
              <DropdownMenuItem
                key={idx}
                onClick={() => action.onClick(row)}
                disabled={action.disabled}
                className={
                  isDestructive
                    ? "focus:bg-red-500/20 focus:text-red-400 text-red-400"
                    : "focus:bg-white/10 focus:text-white"
                }
              >
                {Icon && <Icon className="h-4 w-4 mr-2 shrink-0" />}
                {action.label}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
