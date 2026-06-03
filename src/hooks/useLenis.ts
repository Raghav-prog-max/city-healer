import { useEffect, useState } from "react";
import Lenis from "lenis";
import gsap from "gsap";

export function useLenis() {
  const [lenis, setLenis] = useState<Lenis | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Respect user prefers-reduced-motion
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const lenisInstance = new Lenis({
      duration: 1.4,
      lerp: 0.08, // Inertia factor
      easing: (t) => 1 - Math.pow(1 - t, 4), // Butter smooth quartic ease
    });

    setLenis(lenisInstance);

    // Sync Lenis frame looping with GSAP ticker for single unified clock cycle
    const tick = (time: number) => {
      lenisInstance.raf(time * 1000);
    };

    gsap.ticker.add(tick);

    // Force style on root for smooth scrolling
    document.documentElement.style.scrollBehavior = "auto";

    return () => {
      gsap.ticker.remove(tick);
      lenisInstance.destroy();
      document.documentElement.style.scrollBehavior = "";
    };
  }, []);

  return lenis;
}

export default useLenis;
