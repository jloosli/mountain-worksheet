import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useRouter, usePathname } from "next/navigation";
import { serializeState, deserializeState } from "./urlState";

/**
 * State persisted to the URL query string. `check`, if given, runs once over
 * the state opened from the link (with the raw query) and may correct it; its
 * result is returned as the third element so the caller can report problems.
 */
export function useUrlState<T, R extends { state: T } = { state: T }>(
  initialState: T,
  check?: (state: T, query: string) => R
): readonly [T, (newState: T | ((prev: T) => T)) => void, R | null] {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [loaded] = useState<{ state: T; check: R | null }>(() => {
    // Convert URLSearchParams to string for deserialization
    const queryString = searchParams.toString();
    const state = deserializeState(queryString || null, initialState);
    if (!check || !queryString) return { state, check: null };
    const result = check(state, queryString);
    return { state: result.state, check: result };
  });
  const [state, setState] = useState<T>(loaded.state);

  const pendingStateRef = useRef<T | null>(null);

  const updateUrl = useCallback(
    (newState: T) => {
      const queryString = serializeState(newState as Record<string, unknown>);
      const query = queryString ? `?${queryString}` : "";
      const url = `${pathname}${query}`;
      router.push(url, { scroll: false });
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

  return [state, updateState, loaded.check] as const;
}
