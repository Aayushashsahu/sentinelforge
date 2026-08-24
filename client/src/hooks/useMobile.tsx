import { useEffect, useState } from "react";

const MOBILE_BREAKPOINT = 768;

/** Tracks the standard responsive breakpoint used by retained shared UI controls. */
export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" && window.innerWidth < MOBILE_BREAKPOINT);
  useEffect(() => {
    const media = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const update = () => setIsMobile(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return isMobile;
}
