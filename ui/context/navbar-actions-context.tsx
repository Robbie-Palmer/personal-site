"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

interface NavbarActionsContextType {
    hasActions: boolean;
    setHasActions: (hasActions: boolean) => void;
}

const NavbarActionsContext = createContext<NavbarActionsContextType | undefined>(
    undefined,
);

export function NavbarActionsProvider({ children }: { children: ReactNode }) {
    const [hasActions, setHasActions] = useState(false);

    return (
        <NavbarActionsContext.Provider value={{ hasActions, setHasActions }}>
            {children}
        </NavbarActionsContext.Provider>
    );
}

export function useNavbarActions() {
    const context = useContext(NavbarActionsContext);
    if (context === undefined) {
        throw new Error(
            "useNavbarActions must be used within a NavbarActionsProvider",
        );
    }
    return context;
}
