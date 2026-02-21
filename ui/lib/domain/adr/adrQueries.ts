import {
  type DomainRepository,
  getADRSlugsForProject,
  getContentUsingTechnologyByType,
  getProjectForADR,
  getSupersedingADR,
  getTechnologiesForADR,
} from "@/lib/repository";
import { resolveTechnologiesToBadgeViews } from "../technology/technologyViews";
import { type ADRRef, type ADRSlug, makeADRRef, parseADRRef } from "./adr";
import {
  type ADRCardView,
  type ADRDetailView,
  type ADRListItemView,
  toADRCardView,
  toADRDetailView,
  toADRListItemView,
} from "./adrViews";

function summarizeMarkdown(markdown: string): string {
  const paragraphs = markdown
    .split(/\n\s*\n/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .filter((chunk) => !chunk.startsWith("#"));
  if (paragraphs.length === 0) return "";
  const first = paragraphs[0] ?? "";
  return first.length > 280 ? `${first.slice(0, 277)}...` : first;
}

function getADRByRef(repository: DomainRepository, adrRef: ADRRef) {
  return repository.adrs.get(adrRef);
}

function mapADRRefToCardView(
  repository: DomainRepository,
  adrRef: ADRRef,
  projectSlugOverride?: string,
): ADRCardView | null {
  const adr = getADRByRef(repository, adrRef);
  if (!adr) return null;

  const techSlugs = getTechnologiesForADR(repository.graph, adrRef);
  const technologies = resolveTechnologiesToBadgeViews(repository, [
    ...techSlugs,
  ]);
  const ownerProjectSlug = getProjectForADR(repository.graph, adrRef);
  if (!ownerProjectSlug) return null;
  const originRef = adr.inheritsFrom ?? adrRef;
  const { projectSlug: originProjectSlug, adrSlug: originAdrSlug } =
    parseADRRef(originRef);

  const projectSlug = projectSlugOverride ?? ownerProjectSlug;
  const supersedingRef = getSupersedingADR(repository.graph, adrRef);
  const supersededInProject =
    supersedingRef !== undefined &&
    parseADRRef(supersedingRef).projectSlug === projectSlug;
  const isInherited =
    Boolean(adr.inheritsFrom) || ownerProjectSlug !== projectSlug;

  return toADRCardView(adr, technologies, projectSlug, {
    isInherited,
    supersededInProject,
    originProjectSlug,
    originAdrSlug,
  });
}

export function getADRCard(
  repository: DomainRepository,
  adrRef: ADRRef,
): ADRCardView | null {
  return mapADRRefToCardView(repository, adrRef);
}

export function getADRDetail(
  repository: DomainRepository,
  adrRef: ADRRef,
): ADRDetailView | null {
  const adr = repository.adrs.get(adrRef);
  if (!adr) return null;

  const techSlugs = getTechnologiesForADR(repository.graph, adrRef);
  const technologies = resolveTechnologiesToBadgeViews(repository, [
    ...techSlugs,
  ]);
  const ownerProjectSlug = getProjectForADR(repository.graph, adrRef);
  if (!ownerProjectSlug) return null;
  const originRef = adr.inheritsFrom ?? adrRef;
  const { projectSlug: originProjectSlug, adrSlug: originAdrSlug } =
    parseADRRef(originRef);

  const supersedingRef = getSupersedingADR(repository.graph, adrRef);
  const supersededInProject =
    supersedingRef !== undefined &&
    parseADRRef(supersedingRef).projectSlug === ownerProjectSlug;
  const isInherited = Boolean(adr.inheritsFrom);

  return toADRDetailView(adr, technologies, ownerProjectSlug, {
    isInherited,
    supersededInProject,
    originProjectSlug,
    originAdrSlug,
    inheritedSourceSummary: adr.inheritsFrom
      ? summarizeMarkdown(repository.adrs.get(originRef)?.content ?? "")
      : undefined,
    inheritedProjectNotes: adr.inheritsFrom ? adr.content.trim() : undefined,
  });
}

export function getADRDetailForProject(
  repository: DomainRepository,
  projectSlug: string,
  adrSlug: ADRSlug,
): ADRDetailView | null {
  const projectADRRefs = getADRSlugsForProject(repository.graph, projectSlug);
  const matchingRef = projectADRRefs.find(
    (ref) => parseADRRef(ref).adrSlug === adrSlug,
  );
  if (!matchingRef) return null;

  const adr = repository.adrs.get(matchingRef);
  if (!adr) return null;

  const techSlugs = getTechnologiesForADR(repository.graph, matchingRef);
  const technologies = resolveTechnologiesToBadgeViews(repository, [
    ...techSlugs,
  ]);
  const ownerProjectSlug = getProjectForADR(repository.graph, matchingRef);
  if (!ownerProjectSlug) return null;
  const originRef = adr.inheritsFrom ?? matchingRef;
  const { projectSlug: originProjectSlug, adrSlug: originAdrSlug } =
    parseADRRef(originRef);

  const supersedingRef = getSupersedingADR(repository.graph, matchingRef);
  const supersededInProject =
    supersedingRef !== undefined &&
    parseADRRef(supersedingRef).projectSlug === projectSlug;
  const isInherited =
    Boolean(adr.inheritsFrom) || ownerProjectSlug !== projectSlug;

  return toADRDetailView(adr, technologies, projectSlug, {
    isInherited,
    supersededInProject,
    originProjectSlug,
    originAdrSlug,
    inheritedSourceSummary: adr.inheritsFrom
      ? summarizeMarkdown(repository.adrs.get(originRef)?.content ?? "")
      : undefined,
    inheritedProjectNotes: adr.inheritsFrom ? adr.content.trim() : undefined,
  });
}

export function getADRListItem(
  repository: DomainRepository,
  adrRef: ADRRef,
): ADRListItemView | null {
  const adr = repository.adrs.get(adrRef);
  if (!adr) return null;
  return toADRListItemView(adr);
}

export function getAllADRCards(repository: DomainRepository): ADRCardView[] {
  return Array.from(repository.adrs.keys())
    .map((adrRef) => mapADRRefToCardView(repository, adrRef))
    .filter((view): view is ADRCardView => view !== null);
}

export function getAllADRListItems(
  repository: DomainRepository,
): ADRListItemView[] {
  return Array.from(repository.adrs.values()).map(toADRListItemView);
}

function collectProjectADRRefs(
  repository: DomainRepository,
  projectSlug: string,
) {
  return new Set(getADRSlugsForProject(repository.graph, projectSlug));
}

function mapADRRefsToViews(
  repository: DomainRepository,
  adrRefs: Iterable<ADRRef>,
  projectSlugOverride?: string,
): ADRCardView[] {
  return Array.from(adrRefs)
    .map((adrRef) =>
      mapADRRefToCardView(repository, adrRef, projectSlugOverride),
    )
    .filter((view): view is ADRCardView => view !== null);
}

export function getADRsForProject(
  repository: DomainRepository,
  projectSlug: string,
): ADRCardView[] {
  const adrRefs = collectProjectADRRefs(repository, projectSlug);
  if (adrRefs.size === 0) return [];

  return mapADRRefsToViews(repository, adrRefs, projectSlug);
}

export function getADRsUsingTechnology(
  repository: DomainRepository,
  technologySlug: string,
): ADRCardView[] {
  const { adrs: adrRefs } = getContentUsingTechnologyByType(
    repository.graph,
    technologySlug,
  );

  return mapADRRefsToViews(repository, adrRefs);
}

export function getProjectADRRef(
  projectSlug: string,
  adrSlug: ADRSlug,
): ADRRef {
  return makeADRRef(projectSlug, adrSlug);
}
