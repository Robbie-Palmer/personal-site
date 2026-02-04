"use client";

import * as PopoverPrimitive from "@radix-ui/react-popover";
import { CheckIcon, ChevronDownIcon, Search, X } from "lucide-react";
import type * as React from "react";
import { useCallback, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/generic/styles";

export interface MultiSelectOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
  disabled?: boolean;
}

interface MultiSelectProps {
  options: MultiSelectOption[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  label?: string;
  icon?: React.ReactNode;
  maxSelections?: number;
  searchable?: boolean;
  searchPlaceholder?: string;
  className?: string;
  disabled?: boolean;
  size?: "sm" | "default";
}

export function MultiSelect({
  options,
  value,
  onChange,
  placeholder = "Select...",
  label,
  icon,
  maxSelections,
  searchable = true,
  searchPlaceholder = "Search...",
  className,
  disabled = false,
  size = "default",
}: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return options;
    const query = searchQuery.toLowerCase();
    return options.filter((option) =>
      option.label.toLowerCase().includes(query),
    );
  }, [options, searchQuery]);

  const selectedOptions = useMemo(() => {
    return options.filter((option) => value.includes(option.value));
  }, [options, value]);

  const handleToggle = useCallback(
    (optionValue: string) => {
      const isSelected = value.includes(optionValue);
      if (isSelected) {
        onChange(value.filter((v) => v !== optionValue));
      } else {
        if (maxSelections && value.length >= maxSelections) return;
        onChange([...value, optionValue]);
      }
    },
    [value, onChange, maxSelections],
  );

  const handleClear = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onChange([]);
    },
    [onChange],
  );

  const handleRemove = useCallback(
    (optionValue: string, e: React.MouseEvent) => {
      e.stopPropagation();
      onChange(value.filter((v) => v !== optionValue));
    },
    [value, onChange],
  );

  const displayValue = useMemo(() => {
    if (selectedOptions.length === 0) {
      return <span className="text-muted-foreground">{placeholder}</span>;
    }
    if (selectedOptions.length === 1) {
      const option = selectedOptions[0];
      return (
        <span className="flex items-center gap-1.5 truncate">
          {option?.icon}
          {option?.label}
        </span>
      );
    }
    return (
      <span className="flex items-center gap-1.5">
        {selectedOptions.length} selected
      </span>
    );
  }, [selectedOptions, placeholder]);

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger asChild>
        <div
          role="combobox"
          aria-expanded={open}
          aria-haspopup="listbox"
          data-slot="multi-select-trigger"
          tabIndex={disabled ? -1 : 0}
          className={cn(
            "border-input data-[placeholder]:text-muted-foreground [&_svg:not([class*='text-'])]:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 dark:hover:bg-input/50 flex w-fit items-center justify-between gap-2 rounded-md border bg-transparent px-3 py-2 text-sm whitespace-nowrap shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] cursor-pointer [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
            size === "default" && "h-9",
            size === "sm" && "h-8 text-xs px-2",
            disabled && "cursor-not-allowed opacity-50 pointer-events-none",
            className,
          )}
        >
          <span className="flex items-center gap-2 min-w-0">
            {icon}
            {label && (
              <span className="text-muted-foreground shrink-0">{label}:</span>
            )}
            <span className="truncate">{displayValue}</span>
          </span>
          <span className="flex items-center gap-1 shrink-0">
            {value.length > 0 && (
              <button
                type="button"
                onClick={handleClear}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleClear(e as unknown as React.MouseEvent);
                  }
                }}
                className="rounded-full p-0.5 hover:bg-muted transition-colors cursor-pointer"
                aria-label="Clear all selections"
              >
                <X className="size-3" />
              </button>
            )}
            <ChevronDownIcon
              className={cn(
                "size-4 opacity-50 transition-transform",
                open && "rotate-180",
              )}
            />
          </span>
        </div>
      </PopoverPrimitive.Trigger>

      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          data-slot="multi-select-content"
          className={cn(
            "bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 min-w-[200px] max-w-[300px] origin-(--radix-popover-content-transform-origin) overflow-hidden rounded-md border shadow-md",
          )}
          sideOffset={4}
          align="start"
        >
          {searchable && (
            <div className="flex items-center border-b px-3">
              <Search className="size-4 text-muted-foreground shrink-0" />
              <input
                type="text"
                placeholder={searchPlaceholder}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 bg-transparent py-2.5 pl-2 text-sm outline-none placeholder:text-muted-foreground"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="rounded-full p-0.5 hover:bg-muted transition-colors"
                  aria-label="Clear search"
                >
                  <X className="size-3" />
                </button>
              )}
            </div>
          )}

          <div className="max-h-[300px] overflow-y-auto p-1">
            {filteredOptions.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                No options found
              </div>
            ) : (
              filteredOptions.map((option) => {
                const isSelected = value.includes(option.value);
                const isDisabled =
                  option.disabled ||
                  (!isSelected &&
                    maxSelections !== undefined &&
                    value.length >= maxSelections);

                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => !isDisabled && handleToggle(option.value)}
                    disabled={isDisabled}
                    className={cn(
                      "relative flex w-full cursor-default items-center gap-2 rounded-sm py-1.5 pr-2 pl-2 text-sm outline-hidden select-none",
                      "hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
                      isDisabled && "pointer-events-none opacity-50",
                    )}
                  >
                    <div
                      className={cn(
                        "peer size-4 shrink-0 rounded-[4px] border border-input shadow-xs transition-shadow flex items-center justify-center",
                        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
                        isSelected
                          ? "bg-primary border-primary text-primary-foreground"
                          : "bg-background",
                        isDisabled && "cursor-not-allowed opacity-50",
                      )}
                    >
                      {isSelected && <CheckIcon className="size-3" />}
                    </div>
                    {option.icon && (
                      <span className="shrink-0">{option.icon}</span>
                    )}
                    <span className="truncate">{option.label}</span>
                  </button>
                );
              })
            )}
          </div>

          {selectedOptions.length > 0 && (
            <div className="border-t p-2">
              <div className="flex flex-wrap gap-1">
                {selectedOptions.map((option) => (
                  <Badge
                    key={option.value}
                    variant="secondary"
                    className="text-xs gap-1 pr-1"
                  >
                    {option.icon}
                    <span className="truncate max-w-[100px]">
                      {option.label}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => handleRemove(option.value, e)}
                      className="rounded-full p-0.5 hover:bg-background/50 transition-colors"
                      aria-label={`Remove ${option.label}`}
                    >
                      <X className="size-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
