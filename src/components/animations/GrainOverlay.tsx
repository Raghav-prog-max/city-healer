import React from "react";

export function GrainOverlay() {
  return (
    <>
      {/* Invisible SVG filter declaration in DOM */}
      <svg
        className="pointer-events-none fixed -z-50 h-0 w-0 opacity-0"
        aria-hidden="true"
      >
        <defs>
          <filter id="city-grain">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.65"
              numOctaves="3"
              stitchTiles="stitch"
            />
            <feColorMatrix type="matrix" values="0 0 0 0 0   0 0 0 0 0   0 0 0 0 0  0 0 0 0.12 0" />
          </filter>
        </defs>
      </svg>

      {/* Viewport noise grain layer */}
      <div
        className="pointer-events-none fixed inset-0 z-[9990] h-full w-full opacity-[0.035]"
        style={{
          filter: "url(#city-grain)",
          willChange: "transform",
        }}
      />
    </>
  );
}

export default GrainOverlay;
