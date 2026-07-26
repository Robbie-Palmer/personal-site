import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  type RenderOptions,
  render as testingLibraryRender,
} from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";

export * from "@testing-library/react";

export function render(
  ui: ReactElement,
  options?: Omit<RenderOptions, "wrapper">,
) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { gcTime: Number.POSITIVE_INFINITY, retry: false },
      mutations: { retry: false },
    },
  });

  function QueryWrapper({ children }: Readonly<{ children: ReactNode }>) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  }

  return {
    queryClient,
    ...testingLibraryRender(ui, { wrapper: QueryWrapper, ...options }),
  };
}
