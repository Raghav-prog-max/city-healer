import { useState, useEffect } from "react";

export type CursorType = "default" | "pointer" | "card" | "video";

export function useCursor() {
  const [cursorType, setCursorType] = useState<CursorType>("default");
  const [cursorText, setCursorText] = useState<string>("");

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleMouseOver = (e: MouseEvent) => {
      let target = e.target as HTMLElement | null;
      if (!target) return;

      // Check closest selectors to bubble up clean state
      const isPlayMedia = target.closest("[data-cursor='play']");
      const isCardExplore = target.closest("[data-cursor='card']");
      const isPointer = target.closest("button, a, input, select, textarea, [data-cursor='pointer']");

      if (isPlayMedia) {
        setCursorType("video");
        setCursorText("PLAY");
      } else if (isCardExplore) {
        setCursorType("card");
        setCursorText("Explore →");
      } else if (isPointer) {
        setCursorType("pointer");
        setCursorText("");
      } else {
        setCursorType("default");
        setCursorText("");
      }
    };

    window.addEventListener("mouseover", handleMouseOver);
    return () => {
      window.removeEventListener("mouseover", handleMouseOver);
    };
  }, []);

  return { cursorType, cursorText };
}

export default useCursor;
