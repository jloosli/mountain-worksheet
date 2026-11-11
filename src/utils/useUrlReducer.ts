import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useRouter, usePathname } from "next/navigation";
import { serializeState, deserializeState } from "./urlState";

/**
 * A reducer whose state carries a value persisted to the URL query string.
 *
 * The value (`initialValue`'s shape) is opened from the link; `check`, if
 * given, runs once over it (with the raw query) and may correct it; `init`
 * builds the reducer state from the opened value and the check's result.
 * After each event the value `toUrl` picks is written to the URL on the next
 * focus change. Events reduce against the latest state, so several
 * dispatched before a render all apply.
 */
export function useUrlReducer<S, E, T, R extends { state: T } = { state: T }>(
  reducer: (state: S, event: E) => S,
  initialValue: T,
  init: (opened: T, check: R | null) => S,
  toUrl: (state: S) => T,
  check?: (state: T, query: string) => R
): readonly [S, (event: E) => void] {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [initial] = useState<S>(() => {
    const queryString = searchParams.toString();
    const opened = deserializeState(queryString || null, initialValue);
    if (!check || !queryString) return init(opened, null);
    const result = check(opened, queryString);
    return init(result.state, result);
  });
  const [state, setState] = useState<S>(initial);
  const latestRef = useRef<S>(initial);

  const pendingValueRef = useRef<T | null>(null);

  const updateUrl = useCallback(
    (value: T) => {
      const queryString = serializeState(value as Record<string, unknown>);
      const query = queryString ? `?${queryString}` : "";
      router.push(`${pathname}${query}`, { scroll: false });
      pendingValueRef.current = null;
    },
    [pathname, router]
  );

  useEffect(() => {
    const handleFocusChange = () => {
      if (pendingValueRef.current !== null) updateUrl(pendingValueRef.current);
    };
    document.addEventListener("focusin", handleFocusChange);
    document.addEventListener("focusout", handleFocusChange);
    return () => {
      document.removeEventListener("focusin", handleFocusChange);
      document.removeEventListener("focusout", handleFocusChange);
    };
  }, [updateUrl]);

  const dispatch = useCallback(
    (event: E) => {
      const next = reducer(latestRef.current, event);
      latestRef.current = next;
      setState(next);
      pendingValueRef.current = toUrl(next);
    },
    [reducer, toUrl]
  );

  return [state, dispatch] as const;
}
