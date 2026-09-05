import { extractGraphData } from "@/lib/api/graph-data";
import { loadDomainRepository } from "@/lib/domain";

export const dynamic = "force-static";

export function GET() {
  const data = extractGraphData(loadDomainRepository());
  return Response.json(data);
}
