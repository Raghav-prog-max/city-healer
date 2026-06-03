import React, { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

interface FadeUpProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  duration?: number;
  yOffset?: number;
}

export function FadeUp({
  children,
  className = "",
  delay = 0,
  duration = 0.85,
  yOffset = 40,
}: FadeUpProps) {
  const elementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    gsap.registerPlugin(ScrollTrigger);

    const el = elementRef.current;
    if (!el) return;

    // Trigger individual spring/ease animation if batch mode is not handling it
    const anim = gsap.fromTo(
      el,
      { opacity: 0, y: yOffset },
      {
        opacity: 1,
        y: 0,
        duration: duration,
        delay: delay,
        ease: "power3.out",
        scrollTrigger: {
          trigger: el,
          start: "top 88%",
          toggleActions: "play none none none",
        },
        force3D: true,
      }
    );

    return () => {
      if (anim.scrollTrigger) anim.scrollTrigger.kill();
      anim.kill();
    };
  }, [delay, duration, yOffset]);

  return (
    <div
      ref={elementRef}
      className={`animate-item transform-gpu ${className}`}
      style={{ willChange: "transform, opacity" }}
    >
      {children}
    </div>
  );
}

export default FadeUp;
