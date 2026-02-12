import { extractGraphData } from "@/lib/api/graph-data";
import { loadDomainRepository } from "@/lib/domain";
import { LazyKnowledgeGraph } from "./lazy-knowledge-graph";

export function KnowledgeGraph() {
  const repository = loadDomainRepository();
  const data = extractGraphData(repository);
  return <LazyKnowledgeGraph data={data} />;
}
