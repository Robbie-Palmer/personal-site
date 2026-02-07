"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import type {
  ForceGraphData,
  ForceGraphLink,
  ForceGraphNode,
} from "@/lib/api/force-graph-data";

type ForceGraph2DInstance = {
  d3Force: (name: string, force?: unknown) => unknown;
  zoomToFit: (ms?: number, padding?: number) => void;
};

const NODE_COLORS: Record<string, string> = {
  project: "#3b82f6", // blue-500
  blog: "#f97316", // orange-500
  role: "#a855f7", // purple-500
  adr: "#6b7280", // gray-500
  technology: "#22c55e", // green-500
  tag: "#eab308", // yellow-500
};

const EDGE_COLORS: Record<string, string> = {
  USES_TECHNOLOGY: "#22c55e40",
  PART_OF_PROJECT: "#3b82f640",
  SUPERSEDES: "#ef444440",
  CREATED_AT_ROLE: "#a855f740",
  WRITTEN_AT_ROLE: "#f9731640",
  HAS_TAG: "#eab30840",
};

const NODE_TYPE_LABELS: Record<string, string> = {
  project: "Projects",
  blog: "Blog Posts",
  role: "Roles",
  adr: "ADRs",
  technology: "Technologies",
  tag: "Tags",
};

interface ForceGraphClientProps {
  data: ForceGraphData;
}

export function ForceGraphClient({ data }: ForceGraphClientProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<ForceGraph2DInstance | null>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 500 });
  const [hoveredNode, setHoveredNode] = useState<ForceGraphNode | null>(null);
  // biome-ignore lint/suspicious/noExplicitAny: third-party component with complex prop types
  type AnyComponent = React.ComponentType<any>;
  const [ForceGraph2D, setForceGraph2D] = useState<AnyComponent | null>(null);
  const [hiddenTypes, setHiddenTypes] = useState<Set<string>>(new Set());

  // Dynamically import react-force-graph-2d (needs window)
  useEffect(() => {
    import("react-force-graph-2d").then((mod) => {
      setForceGraph2D(() => mod.default);
    });
  }, []);

  // Measure container size
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

  // Filter data based on hidden types
  const filteredData = useMemo(() => {
    if (hiddenTypes.size === 0) return data;
    const visibleNodeIds = new Set(
      data.nodes.filter((n) => !hiddenTypes.has(n.type)).map((n) => n.id),
    );
    return {
      nodes: data.nodes.filter((n) => visibleNodeIds.has(n.id)),
      links: data.links.filter(
        (l) => visibleNodeIds.has(l.source) && visibleNodeIds.has(l.target),
      ),
    };
  }, [data, hiddenTypes]);

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
    for (const node of data.nodes) {
      types.add(node.type);
    }
    return Array.from(types).sort();
  }, [data]);

  const handleNodeClick = useCallback((node: ForceGraphNode) => {
    if (node.href && node.href !== "#") {
      window.open(node.href, "_blank");
    }
  }, []);

  const nodeCanvasObject = useCallback(
    (
      node: ForceGraphNode & { x?: number; y?: number },
      ctx: CanvasRenderingContext2D,
      globalScale: number,
    ) => {
      if (node.x == null || node.y == null) return;

      const isHovered = hoveredNode?.id === node.id;
      const baseSize = Math.sqrt(Math.max(node.connections, 1)) * 3;
      const size = isHovered ? baseSize * 1.4 : baseSize;
      const color = NODE_COLORS[node.type] ?? "#888";

      // Draw node circle
      ctx.beginPath();
      ctx.arc(node.x, node.y, size, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();

      if (isHovered) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Draw label when zoomed in enough or hovered
      const fontSize = isHovered ? 14 / globalScale : 12 / globalScale;
      if (globalScale > 1.5 || isHovered) {
        ctx.font = `${isHovered ? "bold " : ""}${fontSize}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillStyle = isHovered ? color : "#888";
        ctx.fillText(node.name, node.x, node.y + size + 2);
      }
    },
    [hoveredNode],
  );

  const handleEngineStop = useCallback(() => {
    if (graphRef.current) {
      graphRef.current.zoomToFit(400, 40);
    }
  }, []);

  return (
    <Card className="overflow-hidden">
      <div className="p-4 pb-3 space-y-3">
        <h3 className="text-lg font-semibold">Knowledge Graph</h3>
        <p className="text-sm text-muted-foreground">
          Interactive visualization of the content knowledge graph. Click a node
          to visit its page. Scroll to zoom, drag to pan.
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
      </div>
      <div ref={containerRef} className="relative w-full">
        {ForceGraph2D ? (
          <ForceGraph2D
            ref={graphRef}
            graphData={filteredData}
            width={dimensions.width}
            height={dimensions.height}
            backgroundColor="transparent"
            nodeId="id"
            nodeLabel=""
            nodeCanvasObject={nodeCanvasObject}
            nodePointerAreaPaint={(
              node: ForceGraphNode & { x?: number; y?: number },
              color: string,
              ctx: CanvasRenderingContext2D,
            ) => {
              if (node.x == null || node.y == null) return;
              const size = Math.sqrt(Math.max(node.connections, 1)) * 3 + 4;
              ctx.beginPath();
              ctx.arc(node.x, node.y, size, 0, 2 * Math.PI);
              ctx.fillStyle = color;
              ctx.fill();
            }}
            linkColor={(link: ForceGraphLink) =>
              EDGE_COLORS[link.type] ?? "#55555540"
            }
            linkWidth={1}
            onNodeHover={(node: ForceGraphNode | null) => setHoveredNode(node)}
            onNodeClick={handleNodeClick}
            onEngineStop={handleEngineStop}
            cooldownTicks={100}
            warmupTicks={50}
          />
        ) : (
          <div
            className="flex items-center justify-center bg-muted/30"
            style={{ height: dimensions.height }}
          >
            <p className="text-sm text-muted-foreground">Loading graph...</p>
          </div>
        )}
        {hoveredNode && (
          <div className="absolute bottom-3 left-3 bg-card/90 backdrop-blur-sm border rounded-lg px-3 py-2 text-sm shadow-md pointer-events-none">
            <div className="flex items-center gap-2">
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{
                  backgroundColor: NODE_COLORS[hoveredNode.type] ?? "#888",
                }}
              />
              <span className="font-medium">{hoveredNode.name}</span>
              <span className="text-muted-foreground">
                {hoveredNode.connections} connections
              </span>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
