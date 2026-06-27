"use client";

import { Command } from "cmdk";
import {
  BookOpen,
  Briefcase,
  Code2,
  FileText,
  FolderKanban,
  Home,
  Search,
  Tag,
  X,
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import posthog from "posthog-js";
import {
  createContext,
  type ReactNode,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Button } from "@/components/ui/button";
import { useIsMac } from "@/hooks/use-is-mac";
import { hasTechIcon, TechIcon } from "@/lib/api/tech-icons";
import { siteConfig } from "@/lib/config/site-config";
import { cn } from "@/lib/generic/styles";

interface FilterOption {
  value: string;
  label: string;
  icon?: ReactNode;
  group: string;
  paramName: string;
}

/**
 * Minimal, serializable technology shape passed from server components into
 * the (client) command palette so every technology is globally searchable.
 */
export interface PaletteTechnology {
  slug: string;
  name: string;
  iconSlug?: string;
  hasIcon: boolean;
}

interface NavigationItem {
  label: string;
  href: string;
  icon: ReactNode;
  keywords?: string[];
}

interface CommandPaletteContextValue {
  registerFilters: (filters: FilterOption[]) => void;
  unregisterFilters: () => void;
  open: boolean;
  setOpen: (open: boolean) => void;
}

const CommandPaletteContext = createContext<CommandPaletteContextValue | null>(
  null,
);

export function useCommandPalette() {
  const context = useContext(CommandPaletteContext);
  if (!context) {
    throw new Error(
      "useCommandPalette must be used within CommandPaletteProvider",
    );
  }
  return context;
}

export function useRegisterFilters(filters: FilterOption[]) {
  const { registerFilters, unregisterFilters } = useCommandPalette();

  useEffect(() => {
    registerFilters(filters);
    return () => unregisterFilters();
  }, [filters, registerFilters, unregisterFilters]);
}

/**
 * Renders the keyboard shortcut hint, using ⌘ on Mac and Ctrl elsewhere.
 * Pass `className` to control display/spacing at each usage site.
 */
function HotkeyHint({ className }: { className?: string }) {
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

interface CommandPaletteProviderProps {
  children: ReactNode;
  technologies?: PaletteTechnology[];
}

export function CommandPaletteProvider({
  children,
  technologies = [],
}: CommandPaletteProviderProps) {
  const [open, setOpen] = useState(false);
  const [pageFilters, setPageFilters] = useState<FilterOption[]>([]);

  const registerFilters = useCallback((filters: FilterOption[]) => {
    setPageFilters(filters);
  }, []);

  const unregisterFilters = useCallback(() => {
    setPageFilters([]);
  }, []);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => {
          if (!prev) {
            posthog.capture("command_palette_opened", {
              trigger: "keyboard",
            });
          }
          return !prev;
        });
      }
      if (e.key === "Escape" && open) {
        setOpen(false);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [open]);

  const contextValue = useMemo(
    () => ({
      registerFilters,
      unregisterFilters,
      open,
      setOpen,
    }),
    [registerFilters, unregisterFilters, open],
  );

  return (
    <CommandPaletteContext.Provider value={contextValue}>
      {children}
      <Suspense fallback={null}>
        <CommandPaletteDialog
          open={open}
          onOpenChange={setOpen}
          pageFilters={pageFilters}
          technologies={technologies}
        />
      </Suspense>
    </CommandPaletteContext.Provider>
  );
}

interface CommandPaletteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pageFilters: FilterOption[];
  technologies: PaletteTechnology[];
}

function CommandPaletteDialog({
  open,
  onOpenChange,
  pageFilters,
  technologies,
}: CommandPaletteDialogProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const inputRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (open) {
      setSearch("");
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
  }, [open]);

  // Prevent arrow keys from scrolling page when dialog is open
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        e.preventDefault();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

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
        router.replace(`${pathname}${queryString ? `?${queryString}` : ""}`);
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

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in-0"
        onClick={() => onOpenChange(false)}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div className="fixed left-1/2 top-1/4 -translate-x-1/2 w-full max-w-lg animate-in fade-in-0 zoom-in-95 slide-in-from-top-2">
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

            {/* Technologies — globally searchable; gated behind a query to
                keep the default view compact given the large catalogue. */}
            {search.trim().length > 0 && technologies.length > 0 && (
              <Command.Group
                heading="Technologies"
                className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground"
              >
                {technologies.map((tech) => (
                  <Command.Item
                    key={tech.slug}
                    value={`technology ${tech.name}`}
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
                  const active = isFilterActive(filter.paramName, filter.value);
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

          <div className="border-t px-3 py-2 text-xs text-muted-foreground flex items-center justify-between">
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
      </div>
    </div>
  );
}

/**
 * Navbar entry point for the command palette. Renders a compact icon button on
 * mobile and a search-field-styled button (with a subtle hotkey hint) on
 * desktop, showing ⌘K on Mac and Ctrl K elsewhere.
 */
export function CommandPaletteTrigger({ className }: { className?: string }) {
  const { setOpen } = useCommandPalette();

  const handleOpen = useCallback(() => {
    posthog.capture("command_palette_opened", { trigger: "navbar" });
    setOpen(true);
  }, [setOpen]);

  return (
    <>
      {/* Mobile: icon-only */}
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={handleOpen}
        aria-label="Search"
        className={cn("md:hidden", className)}
      >
        <Search className="size-5" />
      </Button>

      {/* Desktop: search-field-styled button with hotkey hint */}
      <button
        type="button"
        onClick={handleOpen}
        aria-label="Search"
        className={cn(
          "hidden md:inline-flex items-center gap-2 h-9 w-44 rounded-md border bg-background px-3 text-sm text-muted-foreground shadow-xs transition-colors hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
          className,
        )}
      >
        <Search className="size-4 shrink-0" />
        <span className="flex-1 text-left">Search</span>
        <HotkeyHint />
      </button>
    </>
  );
}

export function createTechFilterOptions(
  technologies: Array<{ slug: string; name: string; iconSlug?: string }>,
): FilterOption[] {
  return technologies.map((tech) => ({
    value: tech.slug,
    label: tech.name,
    icon: hasTechIcon(tech.name, tech.iconSlug) ? (
      <TechIcon name={tech.name} iconSlug={tech.iconSlug} className="size-3" />
    ) : undefined,
    group: "Technology",
    paramName: "tech",
  }));
}

export function createTagFilterOptions(tags: string[]): FilterOption[] {
  return tags.map((tag) => ({
    value: tag,
    label: tag,
    icon: <Tag className="size-3" />,
    group: "Tag",
    paramName: "tags",
  }));
}

export function createStatusFilterOptions(
  statuses: Array<{ value: string; label: string }>,
  paramName = "status",
): FilterOption[] {
  return statuses.map((status) => ({
    value: status.value,
    label: status.label,
    icon: <FileText className="size-3" />,
    group: "Status",
    paramName,
  }));
}

export function createRoleFilterOptions(
  roles: Array<{ slug: string; company: string; logoPath: string }>,
): FilterOption[] {
  return roles.map((role) => ({
    value: role.slug,
    label: role.company,
    icon: (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={role.logoPath}
        alt={`${role.company} logo`}
        width={12}
        height={12}
        className="size-3 object-contain"
      />
    ),
    group: "Role",
    paramName: "role",
  }));
}
