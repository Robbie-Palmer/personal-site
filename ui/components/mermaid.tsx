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

    let isCancelled = false;

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
          darkMode: isDark,
          primaryColor: isDark ? "#60a5fa" : "#3b82f6",
          primaryTextColor: isDark ? "#e5e7eb" : "#1f2937",
          primaryBorderColor: isDark ? "#374151" : "#d1d5db",
          lineColor: isDark ? "#6b7280" : "#9ca3af",
          secondaryColor: isDark ? "#1f2937" : "#f3f4f6",
          tertiaryColor: isDark ? "#111827" : "#ffffff",
          background: isDark ? "#111827" : "#ffffff",
          mainBkg: isDark ? "#1f2937" : "#f9fafb",
          secondBkg: isDark ? "#374151" : "#f3f4f6",
          clusterBkg: isDark ? "#1f2937" : "#f9fafb",
          edgeLabelBackground: isDark ? "#1f2937" : "#f9fafb",
          fontSize: "16px",
        },
        flowchart: {
          htmlLabels: true,
          curve: "basis",
          padding: 15,
        },
      });

      try {
        if (isCancelled || !containerRef.current) return;

        containerRef.current.innerHTML = "";

        // Generate unique ID for this diagram
        const id = `mermaid-${crypto.randomUUID()}`;
        const { svg } = await mermaid.render(id, diagramWithClasses);

        // Check again after async operation completes
        if (isCancelled || !containerRef.current) return;

        containerRef.current.innerHTML = svg;
      } catch (error) {
        console.error("Error rendering mermaid diagram:", error);
        if (!isCancelled && containerRef.current) {
          // Clear container safely
          containerRef.current.textContent = "";

          // Create error element with safe text content
          const errorElement = document.createElement("pre");
          errorElement.className = "text-red-500";
          errorElement.textContent = `Error rendering diagram: ${error}`;

          containerRef.current.appendChild(errorElement);
        }
      }
    };

    renderDiagram();

    return () => {
      isCancelled = true;
    };
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
