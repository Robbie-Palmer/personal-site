import Link from "next/link";
import type { ComponentPropsWithoutRef } from "react";

type RecipePageLinkProps = Omit<ComponentPropsWithoutRef<"a">, "href"> & {
  href: string;
};

const PUBLIC_RECIPE_PATH = /^\/recipes\/[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Public recipe pages are resolved by a Cloudflare Pages Function rather than
 * Next's static route manifest. They therefore need a document navigation;
 * Next's client router would otherwise resolve the runtime URL as a 404.
 */
export function RecipePageLink({
  href,
  ...props
}: Readonly<RecipePageLinkProps>) {
  if (PUBLIC_RECIPE_PATH.test(href)) {
    return <a href={href} {...props} />;
  }
  return <Link href={href} {...props} />;
}
