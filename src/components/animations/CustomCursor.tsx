import { useEffect, useRef } from "react";
import gsap from "gsap";
import { useCursor, CursorType } from "../../hooks/useCursor";

export function CustomCursor() {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const { cursorType, cursorText } = useCursor();

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Reject rendering if user prefers reduced motion
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
       return;
    }

    const dot = dotRef.current;
    const ring = ringRef.current;
    if (!dot || !ring) return;

    // Use GSAP clean setters for instant/delayed tracking
    const xToDot = gsap.quickTo(dot, "x", { duration: 0.05, ease: "power1.out" });
    const yToDot = gsap.quickTo(dot, "y", { duration: 0.05, ease: "power1.out" });

    // Inner ring moves slower (higher duration / lerp lag)
    const xToRing = gsap.quickTo(ring, "x", { duration: 0.28, ease: "power2.out" });
    const yToRing = gsap.quickTo(ring, "y", { duration: 0.28, ease: "power2.out" });

    // Track mouse coordinates
    const handleMouseMove = (e: MouseEvent) => {
      // Offset cursor by half its default width/height so it is centered on the tip
      xToDot(e.clientX - 4);
      yToDot(e.clientY - 4);

      xToRing(e.clientX - 16);
      yToRing(e.clientY - 16);
    };

    window.addEventListener("mousemove", handleMouseMove);

    // Initial state setup to hide off-screen initially
    gsap.set([dot, ring], { x: -100, y: -100, opacity: 1 });

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, []);

  // Animate cursor changes based on hover types
  useEffect(() => {
    const dot = dotRef.current;
    const ring = ringRef.current;
    if (!dot || !ring) return;

    switch (cursorType) {
      case "pointer":
        gsap.to(dot, { scale: 0, opacity: 0, duration: 0.24 });
        gsap.to(ring, {
          width: 56,
          height: 56,
          xPercent: -20, // Adjust centering
          yPercent: -20,
          backgroundColor: "rgba(14, 165, 233, 0.22)", //Cyan
          borderColor: "rgba(34, 197, 94, 0.9)", // Green
          borderWidth: "1.5px",
          backdropFilter: "blur(2px)",
          duration: 0.24,
        });
        break;

      case "card":
        gsap.to(dot, { scale: 0, opacity: 0, duration: 0.24 });
        gsap.to(ring, {
          width: 80,
          height: 80,
          xPercent: -30,
          yPercent: -30,
          backgroundColor: "#0EA5E9", // Solid medical blue back
          borderColor: "#22C55E",
          borderWidth: "2px",
          duration: 0.24,
        });
        break;

      case "video":
        gsap.to(dot, { scale: 0, opacity: 0, duration: 0.24 });
        gsap.to(ring, {
          width: 72,
          height: 72,
          xPercent: -25,
          yPercent: -25,
          backgroundColor: "#22C55E", // Healing green solid back
          borderColor: "#0ea5e9",
          borderWidth: "2px",
          duration: 0.24,
        });
        break;

      default: // default
        gsap.to(dot, { scale: 1, opacity: 1, duration: 0.24 });
        gsap.to(ring, {
          width: 32,
          height: 32,
          xPercent: 0,
          yPercent: 0,
          backgroundColor: "transparent",
          borderColor: "rgba(14, 165, 233, 0.65)", // Cyan outline
          borderWidth: "1.5px",
          backdropFilter: "none",
          duration: 0.24,
        });
        break;
    }
  }, [cursorType]);

  return (
    <div className="hidden pointer-events-none fixed inset-0 z-[10000] lg:block">
      {/* Dynamic Laser core dot */}
      <div
        ref={dotRef}
        className="fixed left-0 top-0 h-2 w-2 rounded-full bg-cyan-400 mix-blend-difference"
        style={{ willChange: "transform", transformOrigin: "center" }}
      />
      {/* Dynamic lagging circle helper ring */}
      <div
        ref={ringRef}
        className="fixed left-0 top-0 flex items-center justify-center rounded-full border border-cyan-500/60 bg-transparent text-center text-white"
        style={{ willChange: "transform", transformOrigin: "center" }}
      >
        <span
          className={`text-[10px] font-bold tracking-wider transition-opacity duration-200 uppercase font-sans ${
            cursorType === "card" || cursorType === "video" ? "opacity-100" : "opacity-0"
          }`}
        >
          {cursorText}
        </span>
      </div>
    </div>
  );
}

export default CustomCursor;
