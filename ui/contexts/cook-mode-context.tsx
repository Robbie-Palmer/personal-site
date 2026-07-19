"use client";

import { createContext, type ReactNode, useContext, useState } from "react";

interface CookModeContextType {
  cookModeOpen: boolean;
  setCookModeOpen: (open: boolean) => void;
}

const CookModeContext = createContext<CookModeContextType | undefined>(
  undefined,
);

/**
 * Shares whether the cook-mode overlay is open between the recipe content
 * (which mounts it) and body-level UI like the timer dock (which must clear
 * the overlay's footer while it is up).
 */
export function CookModeProvider({ children }: { children: ReactNode }) {
  const [cookModeOpen, setCookModeOpen] = useState(false);

  return (
    <CookModeContext.Provider value={{ cookModeOpen, setCookModeOpen }}>
      {children}
    </CookModeContext.Provider>
  );
}

export function useCookMode() {
  const context = useContext(CookModeContext);
  if (context === undefined) {
    throw new Error("useCookMode must be used within a CookModeProvider");
  }
  return context;
}
