import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useRouter, usePathname } from "next/navigation";
import type { JsonValue } from "./urlState";
import { serializeState, deserializeState } from "./urlState";

const DEBOUNCE_MS = 1000;
const STATE_PARAM = "data";

export type ValidJsonObject = { [key: string]: JsonValue };

export function useUrlState<T extends ValidJsonObject>(
  initialState: T
): readonly [T, (newState: T | ((prev: T) => T)) => void] {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [state, setState] = useState<T>(() => {
    const urlState = deserializeState(searchParams.get(STATE_PARAM));
    return (urlState as T) || initialState;
  });

  const debounceTimerRef = useRef<NodeJS.Timeout | undefined>(undefined);

  const updateUrl = useCallback(
    (newState: T) => {
      const params = new URLSearchParams(searchParams.toString());
      const stateStr = serializeState(newState as JsonValue);

      if (stateStr) {
        params.set(STATE_PARAM, stateStr);
      } else {
        params.delete(STATE_PARAM);
      }

      const search = params.toString();
      const query = search ? `?${search}` : "";
      router.push(`${pathname}${query}`);
    },
    [pathname, router, searchParams]
  );

  const updateState = useCallback(
    (newState: T | ((prev: T) => T)) => {
      setState(newState);

      // Clear existing timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      // Set new timer
      debounceTimerRef.current = setTimeout(() => {
        const finalState =
          typeof newState === "function"
            ? (newState as (prev: T) => T)(state)
            : newState;
        updateUrl(finalState);
      }, DEBOUNCE_MS);
    },
    [state, updateUrl]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  return [state, updateState] as const;
}
