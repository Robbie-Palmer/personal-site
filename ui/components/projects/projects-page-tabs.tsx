"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTabParam } from "@/hooks/use-tab-param";

interface ProjectsPageTabsProps {
  projects: React.ReactNode;
  philosophy: React.ReactNode;
}

export function ProjectsPageTabs({
  projects,
  philosophy,
}: ProjectsPageTabsProps) {
  const { currentTab, onTabChange } = useTabParam("projects");

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
