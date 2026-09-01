"use client";

import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Boxes,
  CalendarRange,
  Check,
  ChevronDown,
  CircleDot,
  Clock3,
  Compass,
  FileCode2,
  FileText,
  GitBranch,
  Library,
  ListTree,
  Network,
  Search,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/generic/styles";

type Tone = "rose" | "blue" | "amber" | "green";

export interface PrototypeProject {
  slug: string;
  title: string;
  description: string;
  date: string;
  status: "idea" | "in_progress" | "live" | "archived" | "completed";
  role?: string;
  tags: string[];
  technologies: { slug: string; name: string }[];
  decisions: { slug: string; title: string; status: string }[];
  decisionCount: number;
}

export interface InitiativePrototype {
  slug: string;
  title: string;
  shortGoal: string;
  description: string;
  question: string;
  projects: PrototypeProject[];
  tone: Tone;
  isPublished: boolean;
  references: readonly string[];
}

interface ProjectPrototypesProps {
  initiatives: InitiativePrototype[];
}

type ViewId = "briefing" | "map" | "library" | "timeline";

interface PrototypeView {
  id: ViewId;
  number: string;
  title: string;
  summary: string;
  icon: typeof Compass;
}

const views = [
  {
    id: "briefing",
    number: "01",
    title: "The briefing",
    summary: "Lead with intent, then offer a few deliberate ways in.",
    icon: Compass,
  },
  {
    id: "map",
    number: "02",
    title: "The living map",
    summary: "Make the relationships themselves the main interface.",
    icon: Network,
  },
  {
    id: "library",
    number: "03",
    title: "The research library",
    summary: "Use a familiar catalogue for a large, durable body of work.",
    icon: Library,
  },
  {
    id: "timeline",
    number: "04",
    title: "The long view",
    summary: "Show how recurring questions evolve across years and roles.",
    icon: CalendarRange,
  },
] as const satisfies readonly PrototypeView[];

const toneStyles: Record<
  Tone,
  { dot: string; soft: string; border: string; text: string; line: string }
> = {
  rose: {
    dot: "bg-rose-500",
    soft: "bg-rose-500/8 dark:bg-rose-400/10",
    border: "border-rose-500/25",
    text: "text-rose-700 dark:text-rose-300",
    line: "bg-rose-400/45",
  },
  blue: {
    dot: "bg-blue-500",
    soft: "bg-blue-500/8 dark:bg-blue-400/10",
    border: "border-blue-500/25",
    text: "text-blue-700 dark:text-blue-300",
    line: "bg-blue-400/45",
  },
  amber: {
    dot: "bg-amber-500",
    soft: "bg-amber-500/8 dark:bg-amber-400/10",
    border: "border-amber-500/25",
    text: "text-amber-700 dark:text-amber-300",
    line: "bg-amber-400/45",
  },
  green: {
    dot: "bg-emerald-500",
    soft: "bg-emerald-500/8 dark:bg-emerald-400/10",
    border: "border-emerald-500/25",
    text: "text-emerald-700 dark:text-emerald-300",
    line: "bg-emerald-400/45",
  },
};

const statusLabels: Record<PrototypeProject["status"], string> = {
  idea: "Idea",
  in_progress: "In progress",
  live: "Live",
  archived: "Archived",
  completed: "Completed",
};

function ProjectLink({
  project,
  className,
  children,
}: {
  project: PrototypeProject;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={`/projects/${project.slug}`} className={className}>
      {children}
    </Link>
  );
}

function PrototypeHeader({
  view,
  thesis,
  bestFor,
  caution,
}: {
  view: PrototypeView;
  thesis: string;
  bestFor: string;
  caution: string;
}) {
  const Icon = view.icon;
  return (
    <div className="mb-8 grid gap-6 border-b pb-8 lg:grid-cols-[1fr_20rem]">
      <div>
        <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          <Icon className="h-4 w-4" /> Approach {view.number}
        </p>
        <h2 className="text-3xl font-semibold tracking-tight md:text-5xl">
          {view.title}
        </h2>
        <p className="mt-4 max-w-2xl text-lg leading-8 text-muted-foreground">
          {thesis}
        </p>
      </div>
      <dl className="grid content-start gap-4 text-sm">
        <div>
          <dt className="font-medium">Strongest when</dt>
          <dd className="mt-1 text-muted-foreground">{bestFor}</dd>
        </div>
        <div>
          <dt className="font-medium">Risk</dt>
          <dd className="mt-1 text-muted-foreground">{caution}</dd>
        </div>
      </dl>
    </div>
  );
}

function BriefingView({ initiatives }: ProjectPrototypesProps) {
  const [selectedSlug, setSelectedSlug] = useState(initiatives[0]?.slug ?? "");
  const [showAllProjects, setShowAllProjects] = useState(false);
  const selected =
    initiatives.find((initiative) => initiative.slug === selectedSlug) ??
    initiatives[0];
  if (!selected) return null;
  const style = toneStyles[selected.tone];

  return (
    <section>
      <PrototypeHeader
        view={views[0]}
        thesis="Treat the page as an edited introduction, not a database. A visitor meets the questions behind the work before seeing individual projects."
        bestFor="Most visitors, especially people arriving without a specific target."
        caution="The editorial choices need occasional maintenance as the body of work changes."
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {initiatives.map((initiative, index) => {
          const initiativeStyle = toneStyles[initiative.tone];
          const isSelected = initiative.slug === selected.slug;
          return (
            <button
              key={initiative.slug}
              type="button"
              onClick={() => {
                setSelectedSlug(initiative.slug);
                setShowAllProjects(false);
              }}
              className={cn(
                "group min-h-48 rounded-2xl border p-5 text-left transition-all hover:-translate-y-0.5 hover:shadow-md",
                isSelected
                  ? `${initiativeStyle.soft} ${initiativeStyle.border} shadow-sm`
                  : "bg-card hover:border-foreground/20",
              )}
            >
              <span className="flex items-center justify-between text-xs text-muted-foreground">
                <span>0{index + 1}</span>
                <span>{initiative.projects.length} projects</span>
              </span>
              <span
                className={cn(
                  "mt-8 block h-2 w-2 rounded-full",
                  initiativeStyle.dot,
                )}
              />
              <span className="mt-3 block text-lg font-semibold leading-snug">
                {initiative.title}
              </span>
              <span className="mt-2 block text-sm leading-6 text-muted-foreground">
                {initiative.shortGoal}
              </span>
            </button>
          );
        })}
      </div>

      <div
        className={cn(
          "mt-6 overflow-hidden rounded-3xl border",
          style.border,
          style.soft,
        )}
      >
        <div className="grid gap-8 p-6 md:p-9 lg:grid-cols-[minmax(0,1fr)_17rem]">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className={style.text}>
                Initiative
              </Badge>
              {!selected.isPublished && (
                <Badge variant="secondary">Illustrative grouping</Badge>
              )}
            </div>
            <h3 className="mt-5 max-w-3xl text-2xl font-semibold leading-tight md:text-4xl">
              {selected.question}
            </h3>
            <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground">
              {selected.description}
            </p>
          </div>
          <div className="space-y-5 border-t pt-6 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Leads into
              </p>
              <p className="mt-2 text-2xl font-semibold">
                {selected.projects.length} projects
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Connected reading
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {selected.references.map((reference) => (
                  <Badge key={reference} variant="outline">
                    {reference}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="border-t bg-background/70 p-3 md:p-4">
          <div className="grid gap-3 lg:grid-cols-3">
            {selected.projects
              .slice(0, showAllProjects ? undefined : 3)
              .map((project, index) => (
                <ProjectLink
                  key={project.slug}
                  project={project}
                  className="group rounded-2xl border bg-card p-5 transition-colors hover:border-foreground/25"
                >
                  <span className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Project {index + 1}</span>
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </span>
                  <span className="mt-5 block text-lg font-semibold">
                    {project.title}
                  </span>
                  <span className="mt-2 block text-sm leading-6 text-muted-foreground">
                    {project.description}
                  </span>
                  <span className="mt-5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span>{statusLabels[project.status]}</span>
                    <span>{project.decisionCount} decisions</span>
                  </span>
                </ProjectLink>
              ))}
          </div>
          {selected.projects.length > 3 && !showAllProjects && (
            <button
              type="button"
              onClick={() => setShowAllProjects(true)}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium hover:bg-muted"
            >
              See {selected.projects.length - 3} more contributing projects
              <ChevronDown className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

function MapView({ initiatives }: ProjectPrototypesProps) {
  const [selectedInitiative, setSelectedInitiative] = useState(
    initiatives[0]?.slug ?? "",
  );
  const active =
    initiatives.find((initiative) => initiative.slug === selectedInitiative) ??
    initiatives[0];
  const [selectedProject, setSelectedProject] = useState(
    active?.projects[0]?.slug ?? "",
  );
  if (!active) return null;
  const project =
    active.projects.find((candidate) => candidate.slug === selectedProject) ??
    active.projects[0];
  const style = toneStyles[active.tone];

  const selectInitiative = (slug: string) => {
    const next = initiatives.find((initiative) => initiative.slug === slug);
    setSelectedInitiative(slug);
    setSelectedProject(next?.projects[0]?.slug ?? "");
  };

  return (
    <section>
      <PrototypeHeader
        view={views[1]}
        thesis="Use the knowledge graph as the page. Selecting a node narrows the field without taking the visitor away, while the side panel turns every stop into a useful summary."
        bestFor="Technically curious visitors who like to wander and notice unexpected links."
        caution="A map can become decorative noise unless focus mode stays ruthless."
      />

      <div className="overflow-hidden rounded-3xl border bg-slate-950 text-slate-50 shadow-2xl shadow-slate-950/10">
        <div className="flex flex-col gap-3 border-b border-white/10 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2 text-sm font-medium">
            <CircleDot className="h-4 w-4 text-cyan-300" />
            Focus mode
            <span className="font-normal text-slate-400">
              One initiative at a time
            </span>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 lg:pb-0">
            {initiatives.map((initiative) => (
              <button
                key={initiative.slug}
                type="button"
                onClick={() => selectInitiative(initiative.slug)}
                className={cn(
                  "whitespace-nowrap rounded-full border px-3 py-1.5 text-xs transition-colors",
                  initiative.slug === active.slug
                    ? "border-white/30 bg-white text-slate-950"
                    : "border-white/10 text-slate-300 hover:border-white/30 hover:text-white",
                )}
              >
                {initiative.title}
              </button>
            ))}
          </div>
        </div>

        <div className="grid min-h-[39rem] lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="relative overflow-hidden p-5 md:p-8">
            <div className="absolute inset-0 opacity-30 [background-image:radial-gradient(circle_at_center,rgba(148,163,184,0.35)_1px,transparent_1px)] [background-size:26px_26px]" />
            <div className="relative z-10 grid gap-8">
              <div className="mx-auto flex max-w-xl items-center gap-3 rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur">
                <span
                  className={cn("h-3 w-3 shrink-0 rounded-full", style.dot)}
                />
                <div>
                  <p className="text-xs uppercase tracking-widest text-slate-400">
                    Initiative
                  </p>
                  <p className="mt-1 font-semibold">{active.title}</p>
                </div>
              </div>

              <div className="mx-auto h-8 w-px bg-gradient-to-b from-white/50 to-white/10" />

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {active.projects.map((candidate) => {
                  const isSelected = candidate.slug === project?.slug;
                  return (
                    <button
                      key={candidate.slug}
                      type="button"
                      onClick={() => setSelectedProject(candidate.slug)}
                      className={cn(
                        "relative rounded-2xl border p-4 text-left transition-all",
                        isSelected
                          ? "border-cyan-300/70 bg-cyan-300/10 shadow-[0_0_35px_rgba(103,232,249,0.08)]"
                          : "border-white/10 bg-slate-900/80 hover:border-white/30",
                      )}
                    >
                      <span className="text-[10px] uppercase tracking-widest text-slate-500">
                        Project
                      </span>
                      <span className="mt-2 block text-sm font-semibold leading-snug">
                        {candidate.title}
                      </span>
                      <span className="mt-3 flex items-center gap-3 text-[11px] text-slate-400">
                        <span>{candidate.decisionCount} ADRs</span>
                        <span>
                          {candidate.technologies.length} technologies
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>

              {project && (
                <>
                  <div className="mx-auto h-8 w-px bg-gradient-to-b from-white/40 to-white/10" />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-dashed border-violet-300/30 bg-violet-300/5 p-4">
                      <p className="flex items-center gap-2 text-xs font-medium text-violet-200">
                        <FileText className="h-4 w-4" /> Decisions
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {project.decisions.slice(0, 3).map((decision) => (
                          <span
                            key={decision.slug}
                            className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300"
                          >
                            {decision.title}
                          </span>
                        ))}
                        {project.decisionCount > 3 && (
                          <span className="px-2 py-1 text-xs text-slate-500">
                            +{project.decisionCount - 3}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-dashed border-emerald-300/30 bg-emerald-300/5 p-4">
                      <p className="flex items-center gap-2 text-xs font-medium text-emerald-200">
                        <FileCode2 className="h-4 w-4" /> Technologies
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {project.technologies.map((technology) => (
                          <Link
                            key={technology.slug}
                            href={`/technologies/${technology.slug}`}
                            className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300 hover:border-emerald-300/40 hover:text-white"
                          >
                            {technology.name}
                          </Link>
                        ))}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          <aside className="border-t border-white/10 bg-slate-900/80 p-6 lg:border-l lg:border-t-0">
            {project && (
              <div className="sticky top-24">
                <p className="text-xs uppercase tracking-widest text-cyan-300">
                  Selected project
                </p>
                <h3 className="mt-3 text-2xl font-semibold leading-tight">
                  {project.title}
                </h3>
                <p className="mt-4 text-sm leading-6 text-slate-300">
                  {project.description}
                </p>
                <dl className="mt-7 grid grid-cols-2 gap-4 border-y border-white/10 py-5 text-sm">
                  <div>
                    <dt className="text-slate-500">Status</dt>
                    <dd className="mt-1">{statusLabels[project.status]}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Started</dt>
                    <dd className="mt-1">{project.date.slice(0, 4)}</dd>
                  </div>
                </dl>
                <ProjectLink
                  project={project}
                  className="mt-6 flex items-center justify-between rounded-xl bg-white px-4 py-3 text-sm font-medium text-slate-950 hover:bg-cyan-100"
                >
                  Open project <ArrowRight className="h-4 w-4" />
                </ProjectLink>
                <p className="mt-5 text-xs leading-5 text-slate-500">
                  Context stays pinned while the visitor tests nearby nodes.
                </p>
              </div>
            )}
          </aside>
        </div>
      </div>
    </section>
  );
}

type LibrarySelection =
  | { type: "initiative"; slug: string }
  | { type: "project"; slug: string };

function LibraryView({ initiatives }: ProjectPrototypesProps) {
  const [selection, setSelection] = useState<LibrarySelection>({
    type: "initiative",
    slug: initiatives[0]?.slug ?? "",
  });
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const visibleInitiatives = useMemo(
    () =>
      initiatives
        .map((initiative) => ({
          ...initiative,
          projects: initiative.projects.filter(
            (project) =>
              !normalizedQuery ||
              `${project.title} ${project.description} ${project.technologies
                .map((technology) => technology.name)
                .join(" ")}`
                .toLowerCase()
                .includes(normalizedQuery),
          ),
        }))
        .filter(
          (initiative) =>
            !normalizedQuery ||
            initiative.title.toLowerCase().includes(normalizedQuery) ||
            initiative.projects.length > 0,
        ),
    [initiatives, normalizedQuery],
  );
  const selectedInitiative = initiatives.find(
    (initiative) =>
      initiative.slug === selection.slug ||
      initiative.projects.some((project) => project.slug === selection.slug),
  );
  const selectedProject = selectedInitiative?.projects.find(
    (project) => project.slug === selection.slug,
  );

  return (
    <section>
      <PrototypeHeader
        view={views[2]}
        thesis="Borrow the calm, predictable patterns of a research archive. The hierarchy lives in a collapsible index; the reading pane gives each item room for real prose."
        bestFor="A large collection that people return to for research or reference."
        caution="It is dependable rather than surprising, so the writing has to supply the personality."
      />

      <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="grid min-h-[46rem] lg:grid-cols-[20rem_minmax(0,1fr)]">
          <aside className="border-b bg-muted/35 lg:border-b-0 lg:border-r">
            <div className="border-b p-4">
              <div className="relative block">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="project-collection-search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search the collection"
                  aria-label="Search the collection"
                  className="bg-background pl-9"
                />
              </div>
              <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                <span>{initiatives.length} initiatives</span>
                <span>
                  {initiatives.reduce(
                    (total, initiative) => total + initiative.projects.length,
                    0,
                  )}{" "}
                  projects
                </span>
              </div>
            </div>
            <nav
              aria-label="Project collection"
              className="max-h-[38rem] overflow-y-auto p-2 lg:max-h-none"
            >
              {visibleInitiatives.map((initiative) => {
                const style = toneStyles[initiative.tone];
                return (
                  <details key={initiative.slug} open className="group/tree">
                    <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium hover:bg-background [&::-webkit-details-marker]:hidden">
                      <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open/tree:rotate-0 -rotate-90" />
                      <span className={cn("h-2 w-2 rounded-full", style.dot)} />
                      <span className="min-w-0 flex-1 truncate text-left">
                        {initiative.title}
                      </span>
                      <span className="text-xs font-normal text-muted-foreground">
                        {initiative.projects.length}
                      </span>
                    </summary>
                    <div className="ml-5 border-l pl-3">
                      <button
                        type="button"
                        onClick={() =>
                          setSelection({
                            type: "initiative",
                            slug: initiative.slug,
                          })
                        }
                        className={cn(
                          "my-0.5 block w-full rounded-lg px-3 py-2 text-left text-sm",
                          selection.type === "initiative" &&
                            selection.slug === initiative.slug
                            ? "bg-background font-medium shadow-sm"
                            : "text-muted-foreground hover:bg-background/70 hover:text-foreground",
                        )}
                      >
                        Overview
                      </button>
                      {initiative.projects.map((project) => (
                        <button
                          key={project.slug}
                          type="button"
                          onClick={() =>
                            setSelection({
                              type: "project",
                              slug: project.slug,
                            })
                          }
                          className={cn(
                            "my-0.5 block w-full rounded-lg px-3 py-2 text-left text-sm",
                            selection.slug === project.slug
                              ? "bg-background font-medium shadow-sm"
                              : "text-muted-foreground hover:bg-background/70 hover:text-foreground",
                          )}
                        >
                          <span className="line-clamp-2">{project.title}</span>
                        </button>
                      ))}
                    </div>
                  </details>
                );
              })}
            </nav>
          </aside>

          <article className="min-w-0 p-6 md:p-10 lg:p-12">
            {selectedInitiative && !selectedProject && (
              <InitiativeLibraryEntry initiative={selectedInitiative} />
            )}
            {selectedInitiative && selectedProject && (
              <ProjectLibraryEntry
                initiative={selectedInitiative}
                project={selectedProject}
              />
            )}
          </article>
        </div>
      </div>
    </section>
  );
}

function InitiativeLibraryEntry({
  initiative,
}: {
  initiative: InitiativePrototype;
}) {
  const style = toneStyles[initiative.tone];
  return (
    <div className="mx-auto max-w-3xl">
      <p
        className={cn(
          "text-xs font-semibold uppercase tracking-widest",
          style.text,
        )}
      >
        Initiative record
      </p>
      <h3 className="mt-4 text-3xl font-semibold tracking-tight md:text-5xl">
        {initiative.title}
      </h3>
      <p className="mt-5 text-xl leading-8 text-muted-foreground">
        {initiative.shortGoal}
      </p>
      <div className="mt-10 grid gap-8 border-y py-8 sm:grid-cols-[1fr_12rem]">
        <div>
          <h4 className="text-sm font-semibold">Working question</h4>
          <p className="mt-2 text-lg leading-7">{initiative.question}</p>
        </div>
        <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-1">
          <div>
            <dt className="text-muted-foreground">Projects</dt>
            <dd className="mt-1 text-2xl font-semibold">
              {initiative.projects.length}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Status</dt>
            <dd className="mt-1 font-medium">
              {initiative.isPublished ? "Published" : "Draft grouping"}
            </dd>
          </div>
        </dl>
      </div>
      <div className="mt-10">
        <h4 className="flex items-center gap-2 text-sm font-semibold">
          <BookOpen className="h-4 w-4" /> Reading shelf
        </h4>
        <div className="mt-4 divide-y rounded-xl border">
          {initiative.references.map((reference, index) => (
            <div key={reference} className="flex items-center gap-4 p-4">
              <span className="text-xs text-muted-foreground">
                0{index + 1}
              </span>
              <span className="text-sm">{reference}</span>
              <Badge variant="secondary" className="ml-auto">
                Topic
              </Badge>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ProjectLibraryEntry({
  initiative,
  project,
}: {
  initiative: InitiativePrototype;
  project: PrototypeProject;
}) {
  const style = toneStyles[initiative.tone];
  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className={cn("h-2 w-2 rounded-full", style.dot)} />
        <span>{initiative.title}</span>
        <span>/</span>
        <span>Project</span>
      </div>
      <h3 className="mt-4 text-3xl font-semibold tracking-tight md:text-5xl">
        {project.title}
      </h3>
      <p className="mt-5 text-xl leading-8 text-muted-foreground">
        {project.description}
      </p>
      <dl className="mt-8 flex flex-wrap gap-x-8 gap-y-3 border-y py-5 text-sm">
        <div>
          <dt className="text-muted-foreground">Status</dt>
          <dd className="mt-1 font-medium">{statusLabels[project.status]}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Year</dt>
          <dd className="mt-1 font-medium">{project.date.slice(0, 4)}</dd>
        </div>
        {project.role && (
          <div>
            <dt className="text-muted-foreground">Context</dt>
            <dd className="mt-1 font-medium">{project.role}</dd>
          </div>
        )}
      </dl>
      <div className="mt-10 grid gap-8 md:grid-cols-2">
        <section>
          <h4 className="flex items-center gap-2 text-sm font-semibold">
            <FileText className="h-4 w-4" /> Decision records
          </h4>
          <div className="mt-4 space-y-2">
            {project.decisions.map((decision) => (
              <Link
                key={decision.slug}
                href={`/projects/${project.slug}/adrs/${decision.slug}`}
                className="flex items-center justify-between rounded-lg border p-3 text-sm hover:bg-muted"
              >
                <span className="line-clamp-1">{decision.title}</span>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </Link>
            ))}
            {project.decisionCount > project.decisions.length && (
              <p className="px-1 pt-2 text-xs text-muted-foreground">
                {project.decisionCount - project.decisions.length} more in the
                project record
              </p>
            )}
          </div>
        </section>
        <section>
          <h4 className="flex items-center gap-2 text-sm font-semibold">
            <FileCode2 className="h-4 w-4" /> Technologies
          </h4>
          <div className="mt-4 flex flex-wrap gap-2">
            {project.technologies.map((technology) => (
              <Link
                key={technology.slug}
                href={`/technologies/${technology.slug}`}
              >
                <Badge variant="outline" className="hover:bg-muted">
                  {technology.name}
                </Badge>
              </Link>
            ))}
          </div>
        </section>
      </div>
      <Button asChild className="mt-10">
        <ProjectLink project={project}>
          Read the project <ArrowRight className="h-4 w-4" />
        </ProjectLink>
      </Button>
    </div>
  );
}

function TimelineView({ initiatives }: ProjectPrototypesProps) {
  const [activeSlugs, setActiveSlugs] = useState(
    () => new Set(initiatives.map((initiative) => initiative.slug)),
  );
  const toggleInitiative = (slug: string) => {
    setActiveSlugs((current) => {
      const next = new Set(current);
      if (next.has(slug) && next.size > 1) next.delete(slug);
      else next.add(slug);
      return next;
    });
  };
  const years = Array.from(
    new Set(
      initiatives.flatMap((initiative) =>
        initiative.projects.map((project) => project.date.slice(0, 4)),
      ),
    ),
  ).sort();

  return (
    <section>
      <PrototypeHeader
        view={views[3]}
        thesis="Make time the organizing principle. Initiative lanes reveal recurring concerns, gaps, and moments when one project changed the direction of later work."
        bestFor="Showing a career-long body of work and the way ideas compound across roles."
        caution="Visitors looking for one technology or decision need a secondary search path."
      />

      <div className="rounded-3xl border bg-card p-4 md:p-7">
        <div className="flex flex-col gap-4 border-b pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-medium">Follow the threads</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Toggle lanes to compare how an idea changes over time.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {initiatives.map((initiative) => {
              const style = toneStyles[initiative.tone];
              const isActive = activeSlugs.has(initiative.slug);
              return (
                <button
                  key={initiative.slug}
                  type="button"
                  onClick={() => toggleInitiative(initiative.slug)}
                  className={cn(
                    "flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition-opacity",
                    isActive ? "bg-background" : "opacity-45",
                  )}
                >
                  <span className={cn("h-2 w-2 rounded-full", style.dot)} />
                  {initiative.title}
                  {isActive && <Check className="h-3 w-3" />}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-8 overflow-x-auto pb-4">
          <div className="min-w-[68rem]">
            <div
              className="grid border-b pb-3 text-center text-xs text-muted-foreground"
              style={{
                gridTemplateColumns: `12rem repeat(${years.length}, minmax(7rem, 1fr))`,
              }}
            >
              <span className="text-left">Initiative</span>
              {years.map((year) => (
                <span key={year}>{year}</span>
              ))}
            </div>

            <div className="divide-y">
              {initiatives.map((initiative) => {
                const style = toneStyles[initiative.tone];
                const isActive = activeSlugs.has(initiative.slug);
                return (
                  <div
                    key={initiative.slug}
                    className={cn(
                      "grid min-h-44 transition-opacity",
                      !isActive && "opacity-20",
                    )}
                    style={{
                      gridTemplateColumns: `12rem repeat(${years.length}, minmax(7rem, 1fr))`,
                    }}
                  >
                    <div className="sticky left-0 z-10 bg-card py-5 pr-5">
                      <span
                        className={cn("block h-2 w-8 rounded-full", style.dot)}
                      />
                      <h3 className="mt-3 text-sm font-semibold leading-snug">
                        {initiative.title}
                      </h3>
                      <p className="mt-2 text-xs leading-5 text-muted-foreground">
                        {initiative.shortGoal}
                      </p>
                    </div>
                    {years.map((year) => {
                      const yearProjects = initiative.projects.filter(
                        (project) => project.date.startsWith(year),
                      );
                      return (
                        <div
                          key={year}
                          className="relative border-l border-dashed px-2 py-5"
                        >
                          <span
                            className={cn(
                              "absolute left-0 top-8 h-0.5 w-full opacity-25",
                              style.line,
                            )}
                          />
                          <div className="relative space-y-2">
                            {yearProjects.map((project) => (
                              <ProjectLink
                                key={project.slug}
                                project={project}
                                className={cn(
                                  "group block rounded-xl border bg-background p-3 shadow-sm transition-transform hover:-translate-y-0.5 hover:shadow-md",
                                  style.border,
                                )}
                              >
                                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                                  {project.role ?? statusLabels[project.status]}
                                </span>
                                <span className="mt-1 block text-xs font-semibold leading-snug">
                                  {project.title}
                                </span>
                                {project.decisionCount > 0 && (
                                  <span className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground">
                                    <GitBranch className="h-3 w-3" />
                                    {project.decisionCount} decisions
                                  </span>
                                )}
                              </ProjectLink>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-3 border-t pt-6 md:grid-cols-3">
          <div className="rounded-xl bg-muted/60 p-4">
            <Clock3 className="h-4 w-4 text-muted-foreground" />
            <p className="mt-3 text-sm font-medium">Patterns become visible</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              A seven-year initiative reads as a sustained concern, not five
              unrelated project cards.
            </p>
          </div>
          <div className="rounded-xl bg-muted/60 p-4">
            <GitBranch className="h-4 w-4 text-muted-foreground" />
            <p className="mt-3 text-sm font-medium">
              Decisions mark inflection points
            </p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Important ADRs and future PDRs can sit directly on the line that
              they changed.
            </p>
          </div>
          <div className="rounded-xl bg-muted/60 p-4">
            <Sparkles className="h-4 w-4 text-muted-foreground" />
            <p className="mt-3 text-sm font-medium">
              New work has somewhere to go
            </p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Terminal projects can extend an existing thread or begin a new
              lane without enlarging a single card grid.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

export function ProjectPrototypes({ initiatives }: ProjectPrototypesProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedView = searchParams.get("view") as ViewId | null;
  const activeView = views.some((view) => view.id === requestedView)
    ? (requestedView as ViewId)
    : "briefing";

  const setView = (view: ViewId) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", view);
    router.replace(`/projects/prototypes?${params.toString()}`, {
      scroll: false,
    });
  };

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8 md:py-12">
      <div className="mb-8">
        <Button asChild variant="ghost" size="sm" className="-ml-3 mb-5">
          <Link href="/projects">
            <ArrowLeft className="h-4 w-4" /> Current projects page
          </Link>
        </Button>
        <div className="grid gap-6 lg:grid-cols-[1fr_22rem] lg:items-end">
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              Project page design study
            </p>
            <h1 className="mt-2 max-w-4xl text-4xl font-semibold tracking-tight md:text-6xl">
              Four ways through the work
            </h1>
            <p className="mt-5 max-w-3xl text-lg leading-8 text-muted-foreground">
              The same initiatives and projects, organized around four different
              visitor behaviours. Three initiative groupings are illustrative so
              the hierarchy can be tested before the real graph fills out.
            </p>
          </div>
          <div className="rounded-2xl border bg-muted/40 p-4 text-sm leading-6 text-muted-foreground">
            <p className="font-medium text-foreground">What stays constant</p>
            <p className="mt-1">
              Initiative prose is visible early. Project detail, decisions,
              references, and technologies reveal themselves one step at a time.
            </p>
          </div>
        </div>
      </div>

      <div className="sticky top-[4.5rem] z-30 -mx-4 mb-10 border-y bg-background/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-2 md:grid-cols-4">
          {views.map((view) => {
            const Icon = view.icon;
            const isActive = view.id === activeView;
            return (
              <button
                key={view.id}
                type="button"
                onClick={() => setView(view.id)}
                className={cn(
                  "flex min-w-0 items-center gap-3 rounded-xl border p-3 text-left transition-colors",
                  isActive
                    ? "border-foreground/20 bg-foreground text-background"
                    : "border-transparent hover:border-border hover:bg-muted",
                )}
              >
                <span
                  className={cn(
                    "hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg sm:flex",
                    isActive ? "bg-background/15" : "bg-muted",
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[10px] uppercase tracking-widest opacity-65">
                    {view.number}
                  </span>
                  <span className="block truncate text-sm font-medium">
                    {view.title}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="animate-in fade-in-50 duration-300">
        {activeView === "briefing" && (
          <BriefingView initiatives={initiatives} />
        )}
        {activeView === "map" && <MapView initiatives={initiatives} />}
        {activeView === "library" && <LibraryView initiatives={initiatives} />}
        {activeView === "timeline" && (
          <TimelineView initiatives={initiatives} />
        )}
      </div>

      <div className="mt-12 flex flex-col gap-4 rounded-2xl border bg-muted/40 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-medium">A likely answer is a hybrid</p>
          <p className="mt-1 text-sm text-muted-foreground">
            The briefing is the strongest front door. The library and map are
            better secondary modes once someone has chosen a thread.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Boxes className="h-4 w-4" /> 4 approaches
          <ListTree className="ml-2 h-4 w-4" /> 4 hierarchy levels
        </div>
      </div>
    </div>
  );
}
