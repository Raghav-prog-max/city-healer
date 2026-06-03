import React, { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

interface ParallaxLayerProps {
  children: React.ReactNode;
  speed: number; // Multiplier, e.g., 0.2, 0.3, 0.6
  className?: string;
}

export function ParallaxLayer({
  children,
  speed,
  className = "",
}: ParallaxLayerProps) {
  const layerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    gsap.registerPlugin(ScrollTrigger);

    const element = layerRef.current;
    if (!element) return;

    // Standard translation calculations based on relative speed
    // speed = 1 means normal scroll. speed = 0.3 means moving much slower (lagging behind)
    const yShift = (1 - speed) * 180; // Total maximum parallax translation range in px

    const anim = gsap.fromTo(
      element,
      { y: -yShift / 2 },
      {
        y: yShift / 2,
        ease: "none",
        scrollTrigger: {
          trigger: element,
          start: "top bottom",
          end: "bottom top",
          scrub: 1.2, // Smooth, damped response
        },
      }
    );

    return () => {
      if (anim.scrollTrigger) anim.scrollTrigger.kill();
      anim.kill();
    };
  }, [speed]);

  return (
    <div ref={layerRef} className={`parallax-layer ${className}`}>
      {children}
    </div>
  );
}

export default ParallaxLayer;
