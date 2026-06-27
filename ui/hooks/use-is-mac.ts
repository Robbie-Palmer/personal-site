"use client";

import { useEffect, useState } from "react";

/**
 * Whether the user is on an Apple platform, for showing ⌘ vs Ctrl. Starts
 * `false` and resolves after mount so SSR and first client render agree.
 */
export function useIsMac() {
  const [isMac, setIsMac] = useState(false);

  useEffect(() => {
    setIsMac(/Mac|iPhone|iPad|iPod/i.test(navigator.userAgent));
  }, []);

  return isMac;
}
