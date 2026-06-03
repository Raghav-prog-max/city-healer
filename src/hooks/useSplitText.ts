import { useEffect, RefObject } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import SplitType from "split-type";

export function useSplitText(
  refOrSelector: string | RefObject<HTMLElement | null>,
  isActive: boolean = true
) {
  useEffect(() => {
    if (!isActive || typeof window === "undefined") return;

    // Reject animations if prefers-reduced-motion is enabled
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    gsap.registerPlugin(ScrollTrigger);

    const elements: HTMLElement[] = [];
    if (typeof refOrSelector === "string") {
      document.querySelectorAll(refOrSelector).forEach((el) => {
        if (el instanceof HTMLElement) elements.push(el);
      });
    } else {
      if (refOrSelector.current) {
        elements.push(refOrSelector.current);
      }
    }

    const splitInstances: SplitType[] = [];
    const scrollTriggers: ScrollTrigger[] = [];

    elements.forEach((element) => {
      // Split the text content into words
      const textSplit = new SplitType(element, { types: "words" });
      splitInstances.push(textSplit);

      const words = textSplit.words;
      if (!words || words.length === 0) return;

      // Wrap each word in a div with overflow hidden
      words.forEach((word) => {
        const parent = word.parentNode;
        if (!parent) return;

        const wrapper = document.createElement("span");
        // Style as inline-block to preserve layout flow and hide overflow
        wrapper.style.display = "inline-block";
        wrapper.style.overflow = "hidden";
        wrapper.style.verticalAlign = "bottom";
        wrapper.style.lineHeight = "1.2";
        wrapper.className = "word-trigger-mask";

        // Insert wrapper before word, then move word into wrapper
        parent.insertBefore(wrapper, word);
        wrapper.appendChild(word);

        // Prep actual word animation starts - 110% transform and subtle rotation
        gsap.set(word, {
          y: "110%",
          rotate: 6,
          display: "inline-block",
          transformOrigin: "left center",
          willChange: "transform, opacity",
        });
      });

      // Assemble ScrollTrigger animation
      const trigger = ScrollTrigger.create({
        trigger: element,
        start: "top 85%",
        toggleActions: "play none none none",
        onEnter: () => {
          gsap.to(words, {
            y: "0%",
            rotate: 0,
            duration: 0.85,
            stagger: 0.07,
            ease: "power3.out",
            force3D: true,
          });
        },
      });

      scrollTriggers.push(trigger);
    });

    return () => {
      scrollTriggers.forEach((t) => t.kill());
      splitInstances.forEach((s) => s.revert());
    };
  }, [refOrSelector, isActive]);
}

export default useSplitText;
