import React from "react";

export function GrainOverlay() {
  // A high-performance base64 SVG static repeating noise tile.
  // This uses a lighter fractalNoise compiled once by the browser and rendered via GPU-accelerated
  // background repeating texture, entirely eliminating heavy CPU/GPU filter redraw overhead on scroll.
  const noiseSvg = `data:image/svg+xml;utf8,<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"><filter id="noiseFilter"><feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="1" stitchTiles="stitch"/></filter><rect width="100%" height="100%" filter="url(%23noiseFilter)" opacity="0.10"/></svg>`;

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[9990] h-full w-full opacity-[0.18]"
      style={{
        backgroundImage: `url("${noiseSvg}")`,
        backgroundRepeat: "repeat",
        willChange: "transform",
      }}
    />
  );
}

export default GrainOverlay;
