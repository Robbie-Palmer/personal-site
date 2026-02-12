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
import { hasTechIcon, TechIcon } from "@/lib/api/tech-icons";
import { cn } from "@/lib/generic/styles";

interface FilterOption {
  value: string;
  label: string;
  icon?: ReactNode;
  group: string;
  paramName: string;
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
}

export function CommandPaletteProvider({
  children,
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
        />
      </Suspense>
    </CommandPaletteContext.Provider>
  );
}

interface CommandPaletteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pageFilters: FilterOption[];
}

function CommandPaletteDialog({
  open,
  onOpenChange,
  pageFilters,
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
            <kbd className="hidden sm:inline-flex ml-2 pointer-events-none h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
              <span className="text-xs">⌘</span>K
            </kbd>
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
                onSelect={() =>
                  handleSelect(() =>
                    window.open(
                      "https://github.com/Robbie-Palmer/personal-site",
                      "_blank",
                      "noopener,noreferrer",
                    ),
                  )
                }
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
