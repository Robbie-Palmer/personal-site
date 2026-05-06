"use client";

import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTabParam } from "@/hooks/use-tab-param";

interface ProjectTabsProps {
  overview: React.ReactNode;
  adrs: React.ReactNode;
  adrCount: number;
}

export function ProjectTabs({ overview, adrs, adrCount }: ProjectTabsProps) {
  const { currentTab, onTabChange } = useTabParam("overview");

  return (
    <Tabs value={currentTab} onValueChange={onTabChange} className="w-full">
      <TabsList className="w-full justify-start h-auto p-1 bg-muted rounded-md flex-wrap sm:inline-flex sm:w-auto sm:flex-nowrap">
        <TabsTrigger
          value="overview"
          className="flex-1 sm:flex-none sm:w-[150px]"
        >
          Overview
        </TabsTrigger>
        <TabsTrigger value="adrs" className="flex-1 sm:flex-none sm:w-[250px]">
          Architecture Decisions
          <Badge
            variant="secondary"
            className="ml-2 bg-muted-foreground/10 text-xs"
          >
            {adrCount}
          </Badge>
        </TabsTrigger>
      </TabsList>

      <TabsContent
        value="overview"
        className="animate-in fade-in-50 duration-500 mt-4"
      >
        {overview}
      </TabsContent>

      <TabsContent
        value="adrs"
        className="animate-in fade-in-50 duration-500 mt-4"
      >
        {adrs}
      </TabsContent>
    </Tabs>
  );
}
