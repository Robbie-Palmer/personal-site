"use client";

import mermaid from "mermaid";
import { useTheme } from "next-themes";
import { useEffect, useRef, useState } from "react";

interface MermaidProps {
  chart: string;
  className?: string;
}

export function Mermaid({ chart, className = "" }: MermaidProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !containerRef.current) return;

    const renderDiagram = async () => {
      const isDark = resolvedTheme === "dark";
      const textColor = isDark ? "#f9fafb" : "#0c0a09";
      const themeClasses = `
				classDef data fill:${isDark ? "#1e40af" : "#93c5fd"},stroke:${isDark ? "#3b82f6" : "#2563eb"},color:${textColor}
				classDef storage fill:${isDark ? "#4338ca" : "#a5b4fc"},stroke:${isDark ? "#6366f1" : "#4f46e5"},color:${textColor}
				classDef person fill:${isDark ? "#5b21b6" : "#ddd6fe"},stroke:${isDark ? "#8b5cf6" : "#7c3aed"},color:${textColor}
				classDef app fill:${isDark ? "#134e4a" : "#99f6e4"},stroke:${isDark ? "#14b8a6" : "#0d9488"},color:${textColor}
				linkStyle default stroke:${isDark ? "#78716c" : "#a8a29e"},stroke-width:2px,color:${isDark ? "#d6d3d1" : "#57534e"}
			`;
      const diagramWithClasses = `${chart}\n${themeClasses}`;
      mermaid.initialize({
        startOnLoad: false,
        theme: isDark ? "dark" : "default",
        themeVariables: {
          darkMode: resolvedTheme === "dark",
          primaryColor: resolvedTheme === "dark" ? "#60a5fa" : "#3b82f6",
          primaryTextColor: resolvedTheme === "dark" ? "#e5e7eb" : "#1f2937",
          primaryBorderColor: resolvedTheme === "dark" ? "#374151" : "#d1d5db",
          lineColor: resolvedTheme === "dark" ? "#6b7280" : "#9ca3af",
          secondaryColor: resolvedTheme === "dark" ? "#1f2937" : "#f3f4f6",
          tertiaryColor: resolvedTheme === "dark" ? "#111827" : "#ffffff",
          background: resolvedTheme === "dark" ? "#111827" : "#ffffff",
          mainBkg: resolvedTheme === "dark" ? "#1f2937" : "#f9fafb",
          secondBkg: resolvedTheme === "dark" ? "#374151" : "#f3f4f6",
          clusterBkg: resolvedTheme === "dark" ? "#1f2937" : "#f9fafb",
          edgeLabelBackground: resolvedTheme === "dark" ? "#1f2937" : "#f9fafb",
          fontSize: "16px",
        },
        flowchart: {
          htmlLabels: true,
          curve: "basis",
          padding: 15,
        },
      });

      try {
        if (containerRef.current) {
          containerRef.current.innerHTML = "";
        }
        // Generate unique ID for this diagram
        const id = `mermaid-${Math.random().toString(36).slice(2, 11)}`;
        const { svg } = await mermaid.render(id, diagramWithClasses);
        if (containerRef.current) {
          containerRef.current.innerHTML = svg;
        }
      } catch (error) {
        console.error("Error rendering mermaid diagram:", error);
        if (containerRef.current) {
          containerRef.current.innerHTML = `<pre class="text-red-500">Error rendering diagram: ${error}</pre>`;
        }
      }
    };

    renderDiagram();
  }, [chart, resolvedTheme, mounted]);

  // Prevent hydration mismatch by not rendering anything server-side
  if (!mounted) {
    return (
      <div
        className={`flex items-center justify-center p-8 ${className}`}
        style={{ minHeight: "200px" }}
      >
        <div className="text-muted-foreground">Loading diagram...</div>
      </div>
    );
  }
  return (
    <div
      ref={containerRef}
      className={`mermaid-diagram flex items-center justify-center ${className}`}
      style={{ minHeight: "200px" }}
    />
  );
}
