import React from "react";

interface MarqueeProps {
  items: string[];
  direction?: "left" | "right";
  speed?: number; // Duration in seconds
}

export function Marquee({
  items,
  direction = "left",
  speed = 30,
}: MarqueeProps) {
  // Triple the items for a perfectly continuous wrap seam
  const loopedItems = [...items, ...items, ...items];

  // Self-contained, highly performant CSS marquee animations
  const marqueeKeyframesStr = `
    @keyframes marquee-spin-left {
      0% { transform: translate3d(0, 0, 0); }
      100% { transform: translate3d(-33.3333%, 0, 0); }
    }
    @keyframes marquee-spin-right {
      0% { transform: translate3d(-33.3333%, 0, 0); }
      100% { transform: translate3d(0, 0, 0); }
    }
    .marquee-inner-left {
      animation: marquee-spin-left ${speed}s linear infinite;
    }
    .marquee-inner-right {
      animation: marquee-spin-right ${speed}s linear infinite;
    }
    .marquee-container-hoverable:hover .marquee-inner-anim {
      animation-play-state: paused;
    }
  `;

  return (
    <div className="marquee-container-hoverable relative w-full overflow-hidden py-3 select-none">
      <style>{marqueeKeyframesStr}</style>

      <div
        className={`flex w-max gap-12 marquee-inner-anim ${
          direction === "left" ? "marquee-inner-left" : "marquee-inner-right"
        }`}
        style={{ willChange: "transform" }}
      >
        {loopedItems.map((item, index) => (
          <div
            key={index}
            className="flex items-center gap-3 font-heading text-base font-extrabold tracking-tight text-slate-500/80 uppercase md:text-lg"
          >
            <span className="h-2 w-2 rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400" />
            <span>{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Marquee;
