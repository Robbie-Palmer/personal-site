"use client";

import {
  SigmaContainer,
  useLoadGraph,
  useRegisterEvents,
  useSigma,
} from "@react-sigma/core";
import "@react-sigma/core/lib/style.css";
import Graph from "graphology";
import forceAtlas2 from "graphology-layout-forceatlas2";
import { ExternalLink, X } from "lucide-react";
import posthog from "posthog-js";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  type GraphData,
  type GraphNode,
  NON_NAVIGABLE_HREF,
} from "@/lib/api/graph-data";

const NODE_COLORS: Record<string, string> = {
  project: "#3b82f6",
  blog: "#f97316",
  role: "#a855f7",
  adr: "#6b7280",
  technology: "#22c55e",
  tag: "#eab308",
};

const EDGE_COLORS: Record<string, string> = {
  USES_TECHNOLOGY: "#22c55eA0",
  PART_OF_PROJECT: "#3b82f6A0",
  SUPERSEDES: "#ef4444A0",
  CREATED_AT_ROLE: "#a855f7A0",
  WRITTEN_AT_ROLE: "#f97316A0",
  HAS_TAG: "#eab308A0",
};

const NODE_TYPE_LABELS: Record<string, string> = {
  project: "Projects",
  blog: "Blog Posts",
  role: "Roles",
  adr: "ADRs",
  technology: "Technologies",
  tag: "Tags",
};

interface SigmaGraphClientProps {
  data: GraphData;
}

interface GraphDataControllerProps {
  filteredData: {
    nodes: (GraphNode & {
      connections: number;
      totalConnections?: number;
    })[];
    edges: { source: string; target: string; type: string }[];
  };
}

const GraphDataController = memo(function GraphDataController({
  filteredData,
}: GraphDataControllerProps) {
  const loadGraph = useLoadGraph();
  const loadedFingerprintRef = useRef<string | null>(null);

  useEffect(() => {
    const fingerprint = JSON.stringify({
      nodeCount: filteredData.nodes.length,
      edgeCount: filteredData.edges.length,
      nodeIds: filteredData.nodes
        .map((n) => n.id)
        .sort()
        .join(","),
      edgeIds: filteredData.edges
        .map((e) => `${e.source}|${e.target}`)
        .sort()
        .join(","),
    });
    // If data hasn't meaningfully changed, skipping reload prevents layout reset
    if (loadedFingerprintRef.current === fingerprint) {
      return;
    }
    loadedFingerprintRef.current = fingerprint;

    const graph = new Graph();
    // Simple string hash function for deterministic positioning
    const hash = (str: string) => {
      let h = 0;
      for (let i = 0; i < str.length; i++) {
        h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
      }
      return h;
    };

    const getDeterministicPos = (id: string) => {
      const h = hash(id);
      // Map hash to 0-100 range to reduce collisions
      const x = Math.abs(h % 100);
      const y = Math.abs(Math.imul(1664525, h) % 100);
      return { x, y };
    };

    for (const node of filteredData.nodes) {
      const baseSize = Math.sqrt(Math.max(node.connections, 1)) * 3;
      const { x, y } = getDeterministicPos(node.id);

      // If the node was previously hidden (not in currentPositions) but now appears,
      // it might be cleaner to spawn it near a neighbor rather than random/hash?
      // For now, deterministic hash is a safe fallback.
      graph.addNode(node.id, {
        x,
        y,
        size: baseSize,
        color: NODE_COLORS[node.type] ?? "#888",
        label: node.name,
        // Store our custom data
        nodeType: node.type,
        href: node.href,
        connections: node.connections,
        totalConnections: node.totalConnections,
        forceFixed: false,
      });
    }

    for (const edge of filteredData.edges) {
      if (!graph.hasNode(edge.source) || !graph.hasNode(edge.target)) continue;
      if (edge.source === edge.target) continue;
      if (graph.hasEdge(edge.source, edge.target)) continue;
      graph.addEdge(edge.source, edge.target, {
        color: EDGE_COLORS[edge.type] ?? "#55555540",
        size: 1,
      });
    }

    if (graph.order > 0) {
      forceAtlas2.assign(graph, {
        iterations: 100,
        settings: {
          gravity: 1, // Stronger gravity for hubs
          scalingRatio: 1, // Controls repulsion/attraction balance
          barnesHutOptimize: true, // Performance optimization
          adjustSizes: true, // Prevent overlap
        },
      });
    }

    loadGraph(graph);
  }, [filteredData, loadGraph]);

  return null;
});

function GraphEventsController({
  setSelectedNode,
}: {
  setSelectedNode: (node: GraphNode | null) => void;
}) {
  const sigma = useSigma();
  const registerEvents = useRegisterEvents();

  useEffect(() => {
    registerEvents({
      clickNode: (event) => {
        const graph = sigma.getGraph();
        const attrs = graph.getNodeAttributes(event.node);
        posthog.capture("graph_node_clicked", {
          node_id: event.node,
          node_type: attrs.nodeType as string,
          node_label: attrs.label as string,
        });
        setSelectedNode({
          id: event.node,
          name: attrs.label as string,
          type: attrs.nodeType as string,
          href: attrs.href as string,
          connections: attrs.connections as number,
          totalConnections: attrs.totalConnections as number,
        } as GraphNode & { totalConnections?: number });
      },
      clickStage: () => {
        setSelectedNode(null);
      },
      enterNode: () => {
        const container = sigma.getContainer();
        container.style.cursor = "pointer";
      },
      leaveNode: () => {
        const container = sigma.getContainer();
        container.style.cursor = "default";
      },
    });
  }, [sigma, registerEvents, setSelectedNode]);

  return null;
}

function GraphSettingsController({
  selectedNode,
}: {
  selectedNode: GraphNode | null;
}) {
  const sigma = useSigma();
  const graph = sigma.getGraph();

  // Pre-calculate neighbors to avoid repeated lookups in the reducer
  const neighbors = useMemo(() => {
    if (!selectedNode) return new Set<string>();
    return new Set(graph.neighbors(selectedNode.id));
  }, [selectedNode, graph]);

  useEffect(() => {
    if (!selectedNode) {
      sigma.setSetting("nodeReducer", null);
      sigma.setSetting("edgeReducer", null);
      return;
    }

    sigma.setSetting(
      "nodeReducer",
      (node: string, data: Record<string, unknown>) => {
        const res = { ...data };
        const isSelected = node === selectedNode.id;
        const isNeighbor = neighbors.has(node);

        if (isSelected) {
          res.highlighted = true;
          res.size = ((data.size as number) ?? 5) * 1.3;
          res.zIndex = 10;
        } else if (isNeighbor) {
          // Keep neighbor visible and show label
          res.highlighted = true;
          res.zIndex = 1;
        } else {
          // Dim other nodes when one is selected
          res.color = "#e5e7eb"; // gray-200
          res.label = ""; // Hide label
          res.zIndex = 0;
        }

        return res;
      },
    );

    sigma.setSetting(
      "edgeReducer",
      (edge: string, data: Record<string, unknown>) => {
        const res = { ...data };
        const endpoints = graph.extremities(edge);
        const isConnected =
          endpoints[0] === selectedNode.id || endpoints[1] === selectedNode.id;

        if (!isConnected) {
          res.hidden = true;
        }
        return res;
      },
    );
  }, [sigma, graph, selectedNode, neighbors]);

  return null;
}

/**
 * Custom hover renderer to support dark mode.
 * Based on Sigma.js default drawDiscNodeHover.
 */
function drawHover(
  context: CanvasRenderingContext2D,
  data: any,
  settings: any,
) {
  const size = settings.labelSize;
  const font = settings.labelFont;
  const weight = settings.labelWeight;
  const isDark = settings.theme === "dark";

  context.font = `${weight} ${size}px ${font}`;
  context.fillStyle = isDark ? "#000" : "#FFF";

  // Dark Mode: White shadow (outer glow)
  // Light Mode: Black shadow
  context.shadowOffsetX = 0;
  context.shadowOffsetY = 0;
  context.shadowBlur = 8;
  context.shadowColor = isDark ? "#333" : "#000";

  const PADDING = 2;

  if (typeof data.label === "string") {
    const textWidth = context.measureText(data.label).width;
    const boxWidth = Math.round(textWidth + 5);
    const boxHeight = Math.round(size + 2 * PADDING);
    const radius = Math.max(data.size, size / 2) + PADDING;
    const angleRadian = Math.asin(boxHeight / 2 / radius);
    const xDeltaCoord = Math.sqrt(Math.abs(radius ** 2 - (boxHeight / 2) ** 2));

    context.beginPath();
    context.moveTo(data.x + xDeltaCoord, data.y + boxHeight / 2);
    context.lineTo(data.x + radius + boxWidth, data.y + boxHeight / 2);
    context.lineTo(data.x + radius + boxWidth, data.y - boxHeight / 2);
    context.lineTo(data.x + xDeltaCoord, data.y - boxHeight / 2);
    context.arc(data.x, data.y, radius, angleRadian, -angleRadian);
    context.closePath();
    context.fill();
  } else {
    context.beginPath();
    context.arc(data.x, data.y, data.size + PADDING, 0, Math.PI * 2);
    context.closePath();
    context.fill();
  }

  context.shadowOffsetX = 0;
  context.shadowOffsetY = 0;
  context.shadowBlur = 0;

  if (!data.label) return;

  const color = settings.labelColor.color || "#000";
  context.fillStyle = color;
  context.font = `${weight} ${size}px ${font}`;
  context.fillText(data.label, data.x + data.size + 3, data.y + size / 3);
}

export function SigmaGraphClient({ data }: SigmaGraphClientProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 500 });
  const [selectedNode, setSelectedNode] = useState<
    (GraphNode & { totalConnections?: number }) | null
  >(null);
  const [hiddenTypes, setHiddenTypes] = useState<Set<string>>(new Set());
  const [minConnections, setMinConnections] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width } = entry.contentRect;
        setDimensions({ width, height: Math.min(width * 0.75, 600) });
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Stabilize data prop to prevent re-renders on hover (due to parent passing new object references)
  const dataFingerprint = `${data.nodes.length}|${data.edges.length}|${data.nodes
    .map((n) => n.id)
    .sort()
    .join(",")}|${data.edges
    .map((e) => `${e.source}>${e.target}`)
    .sort()
    .join(",")}`;
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally using lightweight fingerprint instead of object identity for deep equality
  const stableData = useMemo(() => data, [dataFingerprint]);

  const filteredData = useMemo(() => {
    const typeFilteredNodes =
      hiddenTypes.size === 0
        ? stableData.nodes
        : stableData.nodes.filter((n) => !hiddenTypes.has(n.type));
    const typeFilteredIds = new Set(typeFilteredNodes.map((n) => n.id));
    const hiddenNodeIds = new Set(
      stableData.nodes
        .filter((n) => !typeFilteredIds.has(n.id))
        .map((n) => n.id),
    );

    const edgeSet = new Set<string>();
    const resultEdges: { source: string; target: string; type: string }[] = [];

    function addEdge(source: string, target: string, type: string) {
      if (source === target) return;
      const key =
        source < target ? `${source}|${target}` : `${target}|${source}`;
      if (edgeSet.has(key)) return;
      edgeSet.add(key);
      resultEdges.push({ source, target, type });
    }

    for (const e of stableData.edges) {
      if (typeFilteredIds.has(e.source) && typeFilteredIds.has(e.target)) {
        addEdge(e.source, e.target, e.type);
      }
    }

    // Synthesize transitive technology links through hidden nodes
    if (hiddenNodeIds.size > 0 && !hiddenTypes.has("technology")) {
      const neighbors = new Map<
        string,
        { target: string; type: string; direction: "in" | "out" }[]
      >();
      for (const e of stableData.edges) {
        if (!neighbors.has(e.source)) neighbors.set(e.source, []);
        if (!neighbors.has(e.target)) neighbors.set(e.target, []);
        neighbors.get(e.source)?.push({
          target: e.target,
          type: e.type,
          direction: "out",
        });
        neighbors.get(e.target)?.push({
          target: e.source,
          type: e.type,
          direction: "in",
        });
      }

      const techPrefix = "technology:";

      for (const node of typeFilteredNodes) {
        if (node.id.startsWith(techPrefix)) continue;

        const visited = new Set<string>();
        const queue = [node.id];
        visited.add(node.id);

        let current = queue.shift();
        while (current !== undefined) {
          const currentNeighbors = neighbors.get(current) ?? [];
          for (const edge of currentNeighbors) {
            const neighbor = edge.target;

            if (visited.has(neighbor)) continue;

            // Transitive Logic Constraints:

            // 1. Do NOT traverse HAS_TAG edges.
            //    Tags are for grouping and should not create transitive "usage" relationships.
            //    This prevents Role -> Project A -> Tag -> Project B -> Tech traversal.
            if (edge.type === "HAS_TAG") {
              continue;
            }

            // 2. Do NOT traverse OUTWARD edges to container/context entities.
            //    This prevents child entities from inheriting technologies from their parents.
            //    - Block ADR -> Project (PART_OF_PROJECT)
            //    - Block Project -> Role (CREATED_AT_ROLE)
            //    - Block Blog -> Role (WRITTEN_AT_ROLE)
            if (
              edge.direction === "out" &&
              (edge.type === "PART_OF_PROJECT" ||
                edge.type === "CREATED_AT_ROLE" ||
                edge.type === "WRITTEN_AT_ROLE")
            ) {
              continue;
            }

            visited.add(neighbor);

            if (
              neighbor.startsWith(techPrefix) &&
              typeFilteredIds.has(neighbor)
            ) {
              addEdge(node.id, neighbor, "USES_TECHNOLOGY");
            } else if (hiddenNodeIds.has(neighbor)) {
              queue.push(neighbor);
            }
          }
          current = queue.shift();
        }
      }
    }

    const connectionCounts = new Map<string, number>();
    for (const edge of resultEdges) {
      connectionCounts.set(
        edge.source,
        (connectionCounts.get(edge.source) ?? 0) + 1,
      );
      connectionCounts.set(
        edge.target,
        (connectionCounts.get(edge.target) ?? 0) + 1,
      );
    }
    const finalNodeIds = new Set(
      typeFilteredNodes
        .filter((n) => (connectionCounts.get(n.id) ?? 0) >= minConnections)
        .map((n) => n.id),
    );

    return {
      nodes: typeFilteredNodes
        .filter((n) => finalNodeIds.has(n.id))
        .map((n) => ({
          ...n,
          connections: connectionCounts.get(n.id) ?? 0,
          totalConnections: n.connections,
        })),
      edges: resultEdges.filter(
        (e) => finalNodeIds.has(e.source) && finalNodeIds.has(e.target),
      ),
    };
  }, [stableData, hiddenTypes, minConnections]);

  const maxConnections = useMemo(() => {
    let max = 0;
    for (const node of filteredData.nodes) {
      if (node.connections > max) max = node.connections;
    }
    return max;
  }, [filteredData]);

  const toggleType = useCallback((type: string) => {
    setHiddenTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  }, []);

  const nodeTypes = useMemo(() => {
    const types = new Set<string>();
    for (const node of stableData.nodes) {
      types.add(node.type);
    }
    return Array.from(types).sort();
  }, [stableData]);

  /*
   * We manually observe the .dark class on the document element because
   * usage of next-themes' useTheme hook caused synchronization issues
   * where the graph would render with light mode colors (black text)
   * while the site was visually in dark mode, or vice versa.
   *
   * By observing the DOM directly, we ensure the canvas rendering
   * strictly follows the visual state of the application.
   */
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const checkIsDark = () => {
      setIsDark(document.documentElement.classList.contains("dark"));
    };

    checkIsDark();
    const observer = new MutationObserver(checkIsDark);

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, []);

  // Memoize sigma settings to prevent re-initialization
  const sigmaSettings = useMemo(
    () => ({
      allowInvalidContainer: true,
      renderLabels: true,
      labelRenderedSizeThreshold: 8,
      labelColor: { color: isDark ? "#ffffff" : "#000000" },
      minCameraRatio: 0.1,
      maxCameraRatio: 3,
      defaultEdgeType: "line",
      theme: isDark ? "dark" : "light",
      defaultDrawNodeHover: drawHover,
    }),
    [isDark],
  );

  const sigmaStyle = useMemo(
    () => ({ width: "100%", height: "100%", background: "transparent" }),
    [],
  );

  return (
    <Card className="overflow-hidden p-0 gap-0">
      <div className="p-4 pb-3 space-y-3">
        <h3 className="text-lg font-semibold mt-0">Knowledge Graph</h3>
        <p className="text-sm text-muted-foreground">
          Interactive visualization of the content knowledge graph. Click a node
          to see details. Scroll to zoom, drag to pan.
        </p>
        <div className="flex flex-wrap gap-2">
          {nodeTypes.map((type) => {
            const hidden = hiddenTypes.has(type);
            return (
              <button
                key={type}
                type="button"
                onClick={() => toggleType(type)}
                className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors flex items-center gap-1.5 ${
                  hidden
                    ? "bg-muted/30 text-muted-foreground/50 border-border/50 line-through"
                    : "bg-muted/50 text-muted-foreground border-border hover:bg-muted"
                }`}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full inline-block"
                  style={{
                    backgroundColor: hidden
                      ? "#9ca3af"
                      : (NODE_COLORS[type] ?? "#888"),
                  }}
                />
                {NODE_TYPE_LABELS[type] ?? type}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-3">
          <label
            htmlFor="min-connections"
            className="text-xs text-muted-foreground whitespace-nowrap"
          >
            Min connections
          </label>
          <input
            id="min-connections"
            type="range"
            min={0}
            max={Math.max(maxConnections, 1)}
            value={minConnections}
            onChange={(e) => setMinConnections(Number(e.target.value))}
            className="flex-1 h-1.5 accent-primary"
          />
          <span className="text-xs font-medium tabular-nums w-4 text-right">
            {minConnections}
          </span>
        </div>
      </div>
      <div ref={containerRef} className="relative w-full">
        <div style={{ width: dimensions.width, height: dimensions.height }}>
          <SigmaContainer
            style={sigmaStyle}
            settings={sigmaSettings}
            key={String(isDark)}
          >
            <GraphDataController filteredData={filteredData} />
            <GraphEventsController setSelectedNode={setSelectedNode} />
            <GraphSettingsController selectedNode={selectedNode} />
          </SigmaContainer>
        </div>

        {/* Detail Card for Selected Node */}
        {selectedNode && (
          <div className="p-4 md:p-0 md:absolute md:bottom-4 md:left-4 md:w-80 z-10">
            <Card className="p-4 gap-2 shadow-lg border-primary/20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{
                      backgroundColor: NODE_COLORS[selectedNode.type] ?? "#888",
                    }}
                  />
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {NODE_TYPE_LABELS[selectedNode.type] ?? selectedNode.type}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedNode(null)}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <h4 className="text-lg font-bold leading-tight mt-2">
                {selectedNode.name}
              </h4>

              <p className="text-sm text-muted-foreground mb-2">
                {selectedNode.connections} connection
                {selectedNode.connections !== 1 ? "s" : ""}
                {selectedNode.totalConnections !== undefined &&
                  selectedNode.totalConnections !== selectedNode.connections &&
                  ` (${selectedNode.totalConnections} total)`}
              </p>

              {selectedNode.href &&
                selectedNode.href !== NON_NAVIGABLE_HREF && (
                  <Button asChild className="w-full gap-2" size="sm">
                    <a
                      href={selectedNode.href}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Visit Page
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </Button>
                )}
            </Card>
          </div>
        )}
      </div>
    </Card>
  );
}
