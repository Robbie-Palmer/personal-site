"use client";

import { useEffect, useState } from "react";

/**
 * Detects whether the user is on a Mac so UI can show the right modifier key
 * (⌘ vs Ctrl). Returns `false` until mounted to keep SSR and the first client
 * render in agreement (avoiding hydration mismatches); it then resolves the
 * real platform on the client.
 */
export function useIsMac() {
  const [isMac, setIsMac] = useState(false);

  useEffect(() => {
    setIsMac(/Mac|iPhone|iPad|iPod/i.test(navigator.platform));
  }, []);

  return isMac;
}
