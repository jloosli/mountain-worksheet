import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useRouter, usePathname } from "next/navigation";
import type { URLSerializable } from "./types";
import { serializeState, deserializeState } from "./urlState";

export function useUrlState<TBase, T extends URLSerializable<TBase>>(
  initialState: T
): readonly [T, (newState: T | ((prev: T) => T)) => void] {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [state, setState] = useState<T>(() => {
    return deserializeState(searchParams, initialState);
  });

  const pendingStateRef = useRef<T | null>(null);

  const updateUrl = useCallback(
    (newState: T) => {
      const params = serializeState(newState as Record<string, unknown>);
      const query = params.toString() ? `?${params.toString()}` : "";
      router.push(`${pathname}${query}`, { scroll: false });
      pendingStateRef.current = null;
    },
    [pathname, router]
  );

  // Handle focus change
  useEffect(() => {
    const handleFocusChange = () => {
      if (pendingStateRef.current !== null) {
        updateUrl(pendingStateRef.current);
      }
    };

    // Listen for focus changes within the page
    document.addEventListener("focusin", handleFocusChange);
    document.addEventListener("focusout", handleFocusChange);

    return () => {
      document.removeEventListener("focusin", handleFocusChange);
      document.removeEventListener("focusout", handleFocusChange);
    };
  }, [updateUrl]);

  const updateState = useCallback(
    (newState: T | ((prev: T) => T)) => {
      const finalState =
        typeof newState === "function"
          ? (newState as (prev: T) => T)(state)
          : newState;

      setState(finalState);
      pendingStateRef.current = finalState;
    },
    [state]
  );

  return [state, updateState] as const;
}
