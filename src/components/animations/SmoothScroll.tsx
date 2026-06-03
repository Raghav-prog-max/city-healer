import React from "react";

interface SmoothScrollProps {
  children: React.ReactNode;
}

export function SmoothScroll({ children }: SmoothScrollProps) {
  // Let the browser handle standard scrolling processes naturally inside preview frames and viewports
  return <div className="w-full relative">{children}</div>;
}

export default SmoothScroll;
