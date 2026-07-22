import { useEffect, useState } from "react";

type LoadState<T> = {
  key: string | null;
  data: T | null;
  error: boolean;
};

export function useAbortableLoad<T>(
  key: string | null,
  load: (signal: AbortSignal) => Promise<T>,
  errorMessage: string,
) {
  const [state, setState] = useState<LoadState<T>>({
    key: null,
    data: null,
    error: false,
  });

  useEffect(() => {
    if (!key) return;

    const controller = new AbortController();
    setState({ key, data: null, error: false });
    void load(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) {
          setState({ key, data, error: false });
        }
      })
      .catch((loadError: unknown) => {
        if (
          controller.signal.aborted ||
          (loadError instanceof DOMException && loadError.name === "AbortError")
        ) {
          return;
        }
        console.error(errorMessage, loadError);
        setState({ key, data: null, error: true });
      });

    return () => controller.abort();
  }, [errorMessage, key, load]);

  const matchesCurrentKey = state.key === key;
  return {
    data: matchesCurrentKey ? state.data : null,
    error: matchesCurrentKey && state.error,
  };
}
