import React, { useRef } from "react";
import { useSplitText } from "../../hooks/useSplitText";

interface TextRevealProps {
  children: string;
  className?: string;
  as?: "h1" | "h2" | "h3" | "h4" | "p" | "span";
}

export function TextReveal({
  children,
  className = "",
  as = "h2",
}: TextRevealProps) {
  const elementRef = useRef<HTMLHeadingElement>(null);

  // Invoke our custom split text reveal hook on this element ref
  useSplitText(elementRef);

  // Dynamically map tag type
  const Tag = as;

  return (
    <Tag
      ref={elementRef as any}
      className={`relative inline-block ${className}`}
      style={{ display: "inline-block" }}
    >
      {children}
    </Tag>
  );
}

export default TextReveal;
