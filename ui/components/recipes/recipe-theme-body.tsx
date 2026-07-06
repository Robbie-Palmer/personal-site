"use client";

import { useEffect } from "react";

/**
 * Radix popovers and the mobile filter drawer render in portals attached to
 * `document.body`, which sits outside the `.recipe-theme` wrapper and so would
 * fall back to the site's (dark) default theme. Mirroring the theme + font
 * classes onto the body while the recipe section is mounted lets those portaled
 * surfaces inherit the warm tokens. Page content keeps its own wrapper class, so
 * there is no flash before this effect runs.
 */
export function RecipeThemeBody({ classNames }: { classNames: string }) {
  useEffect(() => {
    const classes = classNames.split(" ").filter(Boolean);
    const body = document.body;
    const added = classes.filter((c) => !body.classList.contains(c));
    body.classList.add(...added);

    const html = document.documentElement;
    html.dataset.sonnerTheme = "light";

    return () => {
      body.classList.remove(...added);
      delete html.dataset.sonnerTheme;
    };
  }, [classNames]);

  return null;
}
