import { useEffect, useRef } from "react";

const visible = () => typeof document === "undefined" || document.visibilityState === "visible";

/**
 * Run `fn` every `ms` while `enabled` and the tab is visible. It also runs once when polling
 * starts (if the tab is visible and `immediate` is true) and once when the tab becomes visible
 * again. While the tab is hidden no timer runs at all. Turning `enabled` off, or unmounting, clears the timer and
 * removes the visibility listener.
 */
export function useVisiblePoll(fn: () => void, ms: number, enabled: boolean, immediate = true) {
  const latest = useRef(fn);
  useEffect(() => { latest.current = fn; });

  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setInterval> | undefined;
    const stop = () => { if (timer !== undefined) clearInterval(timer); timer = undefined; };
    const start = () => { stop(); timer = setInterval(() => latest.current(), ms); };
    const onVisibility = () => {
      if (visible()) { latest.current(); start(); } else stop();
    };
    if (visible()) { if (immediate) latest.current(); start(); }
    document.addEventListener("visibilitychange", onVisibility);
    return () => { stop(); document.removeEventListener("visibilitychange", onVisibility); };
  }, [enabled, ms, immediate]);
}
