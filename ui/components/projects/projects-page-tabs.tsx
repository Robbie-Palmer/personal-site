"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface ProjectsPageTabsProps {
  projects: React.ReactNode;
  philosophy: React.ReactNode;
}

export function ProjectsPageTabs({
  projects,
  philosophy,
}: ProjectsPageTabsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const currentTab = searchParams.get("tab") || "projects";

  const onTabChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", value);
    // Use replace to avoid filling history stack with tab changes,
    // scroll: false to maintain scroll position when switching tabs
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return (
    <Tabs value={currentTab} onValueChange={onTabChange} className="w-full">
      <TabsList className="w-full justify-start h-auto p-1 bg-muted rounded-md flex-wrap sm:inline-flex sm:w-auto sm:flex-nowrap">
        <TabsTrigger
          value="projects"
          className="flex-1 sm:flex-none sm:w-[150px]"
        >
          All Projects
        </TabsTrigger>
        <TabsTrigger
          value="philosophy"
          className="flex-1 sm:flex-none sm:w-[200px]"
        >
          Building Philosophy
        </TabsTrigger>
      </TabsList>

      <TabsContent
        value="projects"
        className="animate-in fade-in-50 duration-500 mt-6"
      >
        {projects}
      </TabsContent>

      <TabsContent
        value="philosophy"
        className="animate-in fade-in-50 duration-500 mt-6"
      >
        {philosophy}
      </TabsContent>
    </Tabs>
  );
}
