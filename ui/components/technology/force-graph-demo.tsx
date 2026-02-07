import { extractForceGraphData } from "@/lib/api/force-graph-data";
import { loadDomainRepository } from "@/lib/domain";
import { LazyForceGraphClient } from "./lazy-force-graph-client";

export function ForceGraphDemo() {
  const repository = loadDomainRepository();
  const data = extractForceGraphData(repository);
  return <LazyForceGraphClient data={data} />;
}
