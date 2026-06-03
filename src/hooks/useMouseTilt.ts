import { useEffect, RefObject } from "react";
import gsap from "gsap";

export function useMouseTilt(
  ref: RefObject<HTMLElement | null>,
  isActive: boolean = true
) {
  useEffect(() => {
    if (!isActive || typeof window === "undefined") return;

    const card = ref.current;
    if (!card) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    // Dynamically insert white radial glass glare overlay if not present
    let glare = card.querySelector(".tilt-glare") as HTMLElement;
    if (!glare) {
      glare = document.createElement("div");
      glare.className = "tilt-glare absolute inset-0 pointer-events-none rounded-[inherit] transition-opacity duration-300 opacity-0 z-30";
      glare.style.mixBlendMode = "overlay";
      glare.style.background = "radial-gradient(circle at 50% 50%, rgba(255,255,255,0.15) 0%, transparent 60%)";
      
      // Ensure the parent card has relative positioning
      const computedStyle = window.getComputedStyle(card);
      if (computedStyle.position === "static") {
        card.style.position = "relative";
      }
      
      card.appendChild(glare);
    }

    const handleMouseMove = (e: MouseEvent) => {
      const rect = card.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const cardW = rect.width;
      const cardH = rect.height;

      // Card tilt rotation metrics
      const rotX = ((mouseY / cardH) - 0.5) * 14;  // Max 14 deg rotation
      const rotY = ((mouseX / cardW) - 0.5) * -14;

      gsap.to(card, {
        transform: `perspective(1000px) rotateX(${rotX}deg) rotateY(${rotY}deg)`,
        duration: 0.15,
        ease: "power2.out",
        overwrite: "auto",
      });

      // Position glass sheen reflection accurately
      glare.style.opacity = "1";
      glare.style.background = `radial-gradient(circle at ${mouseX}px ${mouseY}px, rgba(255,255,255,0.16) 0%, transparent 70%)`;
    };

    const handleMouseLeave = () => {
      // Spring elastic back effect
      gsap.to(card, {
        transform: "perspective(1000px) rotateX(0deg) rotateY(0deg)",
        duration: 0.6,
        ease: "back.out(1.4)",
        overwrite: "auto",
      });

      glare.style.opacity = "0";
    };

    card.addEventListener("mousemove", handleMouseMove);
    card.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      card.removeEventListener("mousemove", handleMouseMove);
      card.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [ref, isActive]);
}

export default useMouseTilt;
