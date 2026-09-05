"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface ProjectsPageTabsProps {
  initiatives: React.ReactNode;
  projects: React.ReactNode;
  philosophy: React.ReactNode;
}

export function ProjectsPageTabs({
  initiatives,
  projects,
  philosophy,
}: Readonly<ProjectsPageTabsProps>) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const requestedTab = searchParams.get("tab");
  const currentTab =
    requestedTab === "initiatives" || requestedTab === "philosophy"
      ? requestedTab
      : "projects";

  const onTabChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", value);
    // Use replace to avoid filling history stack with tab changes,
    // scroll: false to maintain scroll position when switching tabs
    router.replace(`/projects?${params.toString()}`, { scroll: false });
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
          value="initiatives"
          className="flex-1 sm:flex-none sm:w-[150px]"
        >
          Initiatives
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
        value="initiatives"
        className="animate-in fade-in-50 duration-500 mt-6"
      >
        {initiatives}
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
