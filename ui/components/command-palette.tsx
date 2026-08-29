"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Command } from "cmdk";
import {
  BookOpen,
  Briefcase,
  Code2,
  FolderKanban,
  Home,
  Search,
  X,
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import posthog from "posthog-js";
import { type ReactNode, useCallback, useMemo, useRef, useState } from "react";
import type {
  FilterOption,
  PaletteTechnology,
} from "@/components/command-palette-types";
import { useIsMac } from "@/hooks/use-is-mac";
import { TechIcon } from "@/lib/api/tech-icons";
import { siteConfig } from "@/lib/config/site-config";
import { cn } from "@/lib/generic/styles";

interface NavigationItem {
  label: string;
  href: string;
  icon: ReactNode;
  keywords?: string[];
}

function HotkeyHint({ className }: Readonly<{ className?: string }>) {
  const isMac = useIsMac();
  return (
    <kbd
      className={cn(
        "pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium",
        className,
      )}
    >
      {isMac ? <span className="text-xs">⌘</span> : <span>Ctrl</span>}
      <span>K</span>
    </kbd>
  );
}

const NAVIGATION_ITEMS: NavigationItem[] = [
  {
    label: "Home",
    href: "/",
    icon: <Home className="size-4" />,
    keywords: ["home", "main", "index"],
  },
  {
    label: "Blog",
    href: "/blog",
    icon: <BookOpen className="size-4" />,
    keywords: ["blog", "posts", "articles", "writing"],
  },
  {
    label: "Projects",
    href: "/projects",
    icon: <FolderKanban className="size-4" />,
    keywords: ["projects", "work", "portfolio"],
  },
  {
    label: "Experience",
    href: "/experience",
    icon: <Briefcase className="size-4" />,
    keywords: ["experience", "jobs", "career", "work history"],
  },
];

interface CommandPaletteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pageFilters: FilterOption[];
  technologies: PaletteTechnology[];
}

export function CommandPaletteDialog({
  open,
  onOpenChange,
  pageFilters,
  technologies,
}: Readonly<CommandPaletteDialogProps>) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const inputRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState("");

  const handleOpenAutoFocus = useCallback((event: Event) => {
    event.preventDefault();
    setSearch("");
    // Skip auto-focus on touch devices so opening the palette doesn't force
    // the on-screen keyboard up before the user chooses to type.
    if (window.matchMedia("(pointer: coarse)").matches) {
      contentRef.current?.focus();
      return;
    }
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  const handleSelect = useCallback(
    (callback: () => void) => {
      callback();
      onOpenChange(false);
    },
    [onOpenChange],
  );

  const handleNavigation = useCallback(
    (href: string) => {
      posthog.capture("command_palette_action", {
        action_type: "navigation",
        value: href,
      });
      handleSelect(() => router.push(href));
    },
    [router, handleSelect],
  );

  const handleFilter = useCallback(
    (paramName: string, value: string) => {
      posthog.capture("command_palette_action", {
        action_type: "filter",
        value: `${paramName}:${value}`,
      });
      handleSelect(() => {
        const params = new URLSearchParams(searchParams.toString());
        const currentValues = params.get(paramName)?.split(",") ?? [];

        if (currentValues.includes(value)) {
          const newValues = currentValues.filter((v) => v !== value);
          if (newValues.length > 0) {
            params.set(paramName, newValues.join(","));
          } else {
            params.delete(paramName);
          }
        } else {
          params.set(
            paramName,
            [...currentValues, value].filter(Boolean).join(","),
          );
        }

        const queryString = params.toString();
        const querySuffix = queryString ? `?${queryString}` : "";
        router.replace(pathname + querySuffix);
      });
    },
    [router, pathname, searchParams, handleSelect],
  );

  const isFilterActive = useCallback(
    (paramName: string, value: string) => {
      const currentValues = searchParams.get(paramName)?.split(",") ?? [];
      return currentValues.includes(value);
    },
    [searchParams],
  );

  const groupedFilters = useMemo(() => {
    const groups = new Map<string, FilterOption[]>();
    for (const filter of pageFilters) {
      const existing = groups.get(filter.group) ?? [];
      groups.set(filter.group, [...existing, filter]);
    }
    return groups;
  }, [pageFilters]);

  const matchedTechnologies = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return [];
    return technologies
      .filter(
        (tech) =>
          tech.name.toLowerCase().includes(query) ||
          tech.slug.toLowerCase().includes(query),
      )
      .slice(0, 10);
  }, [search, technologies]);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm animate-in fade-in-0" />
        <DialogPrimitive.Content
          ref={contentRef}
          tabIndex={-1}
          aria-describedby={undefined}
          onOpenAutoFocus={handleOpenAutoFocus}
          className="fixed left-1/2 top-1/4 z-50 w-full max-w-lg -translate-x-1/2 animate-in fade-in-0 zoom-in-95 slide-in-from-top-2 outline-none"
        >
          <DialogPrimitive.Title className="sr-only">
            Command palette
          </DialogPrimitive.Title>
          <Command
            className="bg-popover text-popover-foreground rounded-lg border shadow-2xl overflow-hidden"
            shouldFilter={true}
          >
            <div className="flex items-center border-b px-3">
              <Search className="size-4 text-muted-foreground shrink-0" />
              <Command.Input
                ref={inputRef}
                value={search}
                onValueChange={setSearch}
                placeholder="Search or type a command..."
                className="flex-1 bg-transparent py-3 px-2 text-sm outline-none placeholder:text-muted-foreground"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="rounded-full p-1 hover:bg-muted transition-colors"
                  aria-label="Clear search"
                >
                  <X className="size-3" />
                </button>
              )}
              <HotkeyHint className="hidden sm:inline-flex ml-2 text-muted-foreground" />
            </div>

            <Command.List className="max-h-80 overflow-y-auto p-2">
              <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
                No results found.
              </Command.Empty>

              {/* Navigation section */}
              <Command.Group
                heading="Navigation"
                className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground"
              >
                {NAVIGATION_ITEMS.map((item) => (
                  <Command.Item
                    key={item.href}
                    value={`${item.label} ${item.keywords?.join(" ") ?? ""}`}
                    onSelect={() => handleNavigation(item.href)}
                    className={cn(
                      "flex items-center gap-2 px-2 py-1.5 text-sm rounded-sm cursor-pointer",
                      "aria-selected:bg-accent aria-selected:text-accent-foreground",
                      pathname === item.href && "text-primary",
                    )}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                    {pathname === item.href && (
                      <span className="ml-auto text-xs text-muted-foreground">
                        Current
                      </span>
                    )}
                  </Command.Item>
                ))}
              </Command.Group>

              {matchedTechnologies.length > 0 && (
                <Command.Group
                  heading="Technologies"
                  className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground"
                >
                  {matchedTechnologies.map((tech) => (
                    <Command.Item
                      key={tech.slug}
                      value={`${tech.name} ${tech.slug}`}
                      onSelect={() =>
                        handleNavigation(`/technologies/${tech.slug}`)
                      }
                      className="flex items-center gap-2 px-2 py-1.5 text-sm rounded-sm cursor-pointer aria-selected:bg-accent aria-selected:text-accent-foreground"
                    >
                      {tech.hasIcon ? (
                        <TechIcon
                          name={tech.name}
                          iconSlug={tech.iconSlug}
                          className="size-4"
                        />
                      ) : (
                        <Code2 className="size-4" />
                      )}
                      <span>{tech.name}</span>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}

              {/* Page-specific filters */}
              {Array.from(groupedFilters.entries()).map(([group, filters]) => (
                <Command.Group
                  key={group}
                  heading={`Filter by ${group}`}
                  className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground"
                >
                  {filters.map((filter) => {
                    const active = isFilterActive(
                      filter.paramName,
                      filter.value,
                    );
                    return (
                      <Command.Item
                        key={`${filter.paramName}-${filter.value}`}
                        value={`${filter.group} ${filter.label}`}
                        onSelect={() =>
                          handleFilter(filter.paramName, filter.value)
                        }
                        className={cn(
                          "flex items-center gap-2 px-2 py-1.5 text-sm rounded-sm cursor-pointer",
                          "aria-selected:bg-accent aria-selected:text-accent-foreground",
                        )}
                      >
                        {filter.icon}
                        <span>{filter.label}</span>
                        {active && (
                          <span className="ml-auto flex items-center gap-1 text-xs text-primary">
                            <span className="size-1.5 rounded-full bg-primary" />
                            Active
                          </span>
                        )}
                      </Command.Item>
                    );
                  })}
                </Command.Group>
              ))}

              <Command.Group
                heading="Quick Actions"
                className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground"
              >
                <Command.Item
                  value="view source code github"
                  onSelect={() => {
                    posthog.capture("command_palette_action", {
                      action_type: "view_source",
                      value: siteConfig.author.sourceRepo,
                    });
                    handleSelect(() =>
                      window.open(
                        siteConfig.author.sourceRepo,
                        "_blank",
                        "noopener,noreferrer",
                      ),
                    );
                  }}
                  className="flex items-center gap-2 px-2 py-1.5 text-sm rounded-sm cursor-pointer aria-selected:bg-accent aria-selected:text-accent-foreground"
                >
                  <Code2 className="size-4" />
                  <span>View Source Code</span>
                </Command.Item>
              </Command.Group>
            </Command.List>

            <div className="border-t px-3 py-2 text-xs text-muted-foreground hidden sm:flex items-center justify-between">
              <div className="flex items-center gap-2">
                <kbd className="px-1.5 py-0.5 rounded border bg-muted font-mono">
                  ↑↓
                </kbd>
                <span>Navigate</span>
              </div>
              <div className="flex items-center gap-2">
                <kbd className="px-1.5 py-0.5 rounded border bg-muted font-mono">
                  ↵
                </kbd>
                <span>Select</span>
              </div>
              <div className="flex items-center gap-2">
                <kbd className="px-1.5 py-0.5 rounded border bg-muted font-mono">
                  Esc
                </kbd>
                <span>Close</span>
              </div>
            </div>
          </Command>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
