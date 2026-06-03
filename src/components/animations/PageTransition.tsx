import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { Activity } from "lucide-react";

interface PageTransitionProps {
  activeTab: string;
  onChangeTab: (tab: string) => void;
}

export function PageTransition({
  activeTab,
  onChangeTab,
}: PageTransitionProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLDivElement>(null);

  // Keep track of the pending tab change
  const [pendingTab, setPendingTab] = useState<string | null>(null);

  // Exposed function to initiate page transitions
  const transitionToTab = (newTab: string) => {
    if (newTab === activeTab) return;

    const overlay = overlayRef.current;
    const logo = logoRef.current;
    if (!overlay || !logo) {
      // Emergency instant failover if elements are unmounted
      onChangeTab(newTab);
      return;
    }

    setPendingTab(newTab);

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      onChangeTab(newTab);
      return;
    }

    // Master Timeline
    const tl = gsap.timeline({
      defaults: { ease: "expo.inOut" },
    });

    // 1. Sweep In (scaleX 0 -> 1 from left edge)
    tl.set(overlay, { transformOrigin: "left center", scaleX: 0, opacity: 1 });
    tl.to(overlay, {
      scaleX: 1,
      duration: 0.55,
    });

    // 2. Show Logo and change content at cover point
    tl.to(
      logo,
      {
        opacity: 1,
        scale: 1.1,
        duration: 0.2,
      },
      "-=0.1"
    );

    tl.add(() => {
      // Cover complete: Mutate actual page tab state now
      onChangeTab(newTab);
      // Double check scroll-top resetting
      window.scrollTo({ top: 0 });
    });

    // Let the logo pulse briefly
    tl.to(logo, {
      scale: 1.0,
      duration: 0.15,
    });

    // 3. Hide Logo and Sweep Out (scaleX 1 -> 0 towards right edge)
    tl.to(logo, {
      opacity: 0,
      scale: 0.9,
      duration: 0.2,
      delay: 0.1,
    });

    tl.add(() => {
      // Shift origin to right edge so it sweeps out rightward
      gsap.set(overlay, { transformOrigin: "right center" });
    });

    tl.to(overlay, {
      scaleX: 0,
      duration: 0.55,
    });

    tl.set(overlay, { opacity: 0 }); // reset
  };

  // Expose this method globally or attach to general elements
  useEffect(() => {
    (window as any).cityHealerTransition = transitionToTab;
    return () => {
      delete (window as any).cityHealerTransition;
    };
  }, [activeTab, onChangeTab]);

  return (
    <div className="pointer-events-none fixed inset-0 z-[9999]">
      {/* Light White/Blue Sweep Overlay Panel */}
      <div
        ref={overlayRef}
        className="absolute inset-0 bg-[#F8FAFC] border-r border-blue-100 opacity-0"
        style={{ willChange: "transform, opacity", transform: "scaleX(0)" }}
      />

      {/* Glow Centerpiece Transition Logo */}
      <div
        ref={logoRef}
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 flex flex-col items-center space-y-3 z-10"
        style={{ willChange: "transform, opacity" }}
      >
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 p-3 shadow-lg shadow-blue-500/20 animate-pulse">
          <Activity className="h-10 w-10 text-white" />
        </div>
        <span className="font-heading text-lg font-black tracking-widest text-blue-900">
          CITY HEALER
        </span>
      </div>
    </div>
  );
}

export default PageTransition;
