"use client";

import { Menu } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { ProjectWithADRs } from "@/lib/projects";
import { ADRNavContent } from "./adr-nav-content";

interface ADRMobileNavProps {
  project: ProjectWithADRs;
}

export function ADRMobileNav({ project }: ADRMobileNavProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;
  const navbarActions = document.getElementById("navbar-actions");
  if (!navbarActions) return null;

  return createPortal(
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="lg:hidden h-8 w-8 min-[380px]:w-auto min-[380px]:px-3 min-[380px]:gap-2"
        >
          <Menu className="h-4 w-4" />
          <span className="hidden min-[380px]:inline">ADRs</span>
          <span className="sr-only min-[380px]:hidden">ADRs Menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[300px] sm:w-[350px] pr-0">
        <div className="sr-only">
          <SheetTitle>ADR Navigation Menu</SheetTitle>
        </div>
        <ADRNavContent
          project={project}
          className="h-full pt-6 pr-6"
          onLinkClick={() => setOpen(false)}
        />
      </SheetContent>
    </Sheet>,
    navbarActions,
  );
}
