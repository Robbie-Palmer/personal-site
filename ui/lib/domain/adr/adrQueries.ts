import {
  type DomainRepository,
  getADRSlugsForProject,
  getContentUsingTechnologyByType,
  getProjectForADR,
  getSupersedingADR,
  getTechnologiesForADR,
} from "@/lib/repository";
import { resolveTechnologiesToBadgeViews } from "../technology/technologyViews";
import {
  type ADR,
  type ADRRef,
  type ADRSlug,
  makeADRRef,
  parseADRRef,
} from "./adr";
import {
  type ADRCardView,
  type ADRDetailView,
  type ADRListItemView,
  toADRCardView,
  toADRDetailView,
  toADRListItemView,
} from "./adrViews";

function stripMarkdown(markdown: string): string {
  return markdown
    .replace(/!\[[^\]]*]\([^)]+\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^>\s?/gm, "")
    .replace(/(^|\s)>\s?/g, "$1")
    .replace(/[*_~]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function summarizeMarkdown(markdown: string): string {
  const paragraphs = markdown
    .split(/\n\s*\n/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .filter((chunk) => !chunk.startsWith("#"));
  if (paragraphs.length === 0) return "";
  const first = stripMarkdown(paragraphs[0] ?? "");
  return first.length > 280 ? `${first.slice(0, 277)}...` : first;
}

function getADRByRef(repository: DomainRepository, adrRef: ADRRef) {
  return repository.adrs.get(adrRef);
}

interface ADRViewMetadata {
  adr: ADR;
  originRef: ADRRef;
  originProjectSlug: string;
  originAdrSlug: string;
  ownerProjectSlug: string;
  targetProjectSlug: string;
  isInherited: boolean;
  supersededInProject: boolean;
}

function computeADRViewMetadata(
  repository: DomainRepository,
  adrRef: ADRRef,
  projectSlugOverride?: string,
): ADRViewMetadata | null {
  const adr = getADRByRef(repository, adrRef);
  if (!adr) return null;

  const ownerProjectSlug = getProjectForADR(repository.graph, adrRef);
  if (!ownerProjectSlug) return null;

  const targetProjectSlug = projectSlugOverride ?? ownerProjectSlug;
  const originRef = adr.inheritsFrom ?? adrRef;
  const { projectSlug: originProjectSlug, adrSlug: originAdrSlug } =
    parseADRRef(originRef);
  const supersedingRef = getSupersedingADR(repository.graph, adrRef);
  const supersededInProject =
    supersedingRef !== undefined &&
    parseADRRef(supersedingRef).projectSlug === targetProjectSlug;
  const isInherited =
    Boolean(adr.inheritsFrom) || ownerProjectSlug !== targetProjectSlug;

  return {
    adr,
    originRef,
    originProjectSlug,
    originAdrSlug,
    ownerProjectSlug,
    targetProjectSlug,
    isInherited,
    supersededInProject,
  };
}

function buildADRDetailView(
  repository: DomainRepository,
  adrRef: ADRRef,
  projectSlugOverride?: string,
): ADRDetailView | null {
  const metadata = computeADRViewMetadata(
    repository,
    adrRef,
    projectSlugOverride,
  );
  if (!metadata) return null;

  const techSlugs = getTechnologiesForADR(repository.graph, adrRef);
  const technologies = resolveTechnologiesToBadgeViews(repository, [
    ...techSlugs,
  ]);

  return toADRDetailView(
    metadata.adr,
    technologies,
    metadata.targetProjectSlug,
    {
      isInherited: metadata.isInherited,
      supersededInProject: metadata.supersededInProject,
      originProjectSlug: metadata.originProjectSlug,
      originAdrSlug: metadata.originAdrSlug,
      inheritedSourceSummary: metadata.adr.inheritsFrom
        ? summarizeMarkdown(
            repository.adrs.get(metadata.originRef)?.content ?? "",
          )
        : undefined,
      inheritedProjectNotes: metadata.adr.inheritsFrom
        ? metadata.adr.content.trim()
        : undefined,
    },
  );
}

function mapADRRefToCardView(
  repository: DomainRepository,
  adrRef: ADRRef,
  projectSlugOverride?: string,
): ADRCardView | null {
  const metadata = computeADRViewMetadata(
    repository,
    adrRef,
    projectSlugOverride,
  );
  if (!metadata) return null;

  const techSlugs = getTechnologiesForADR(repository.graph, adrRef);
  const technologies = resolveTechnologiesToBadgeViews(repository, [
    ...techSlugs,
  ]);
  return toADRCardView(metadata.adr, technologies, metadata.targetProjectSlug, {
    isInherited: metadata.isInherited,
    supersededInProject: metadata.supersededInProject,
    originProjectSlug: metadata.originProjectSlug,
    originAdrSlug: metadata.originAdrSlug,
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
  return buildADRDetailView(repository, adrRef);
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
  return buildADRDetailView(repository, matchingRef, projectSlug);
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
