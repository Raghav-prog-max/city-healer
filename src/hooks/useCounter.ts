import { useState, useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

export function useCounter(
  endVal: number,
  duration: number = 2.5,
  delay: number = 0
) {
  const [count, setCount] = useState<number>(0);
  const elementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = elementRef.current;
    if (!el || typeof window === "undefined") return;

    gsap.registerPlugin(ScrollTrigger);

    const trigger = ScrollTrigger.create({
      trigger: el,
      start: "top 85%",
      toggleActions: "play none none none",
      onEnter: () => {
        const proxyObj = { val: 0 };
        gsap.to(proxyObj, {
          val: endVal,
          duration: duration,
          delay: delay,
          ease: "power3.out",
          onUpdate: () => {
            setCount(Math.floor(proxyObj.val));
          },
          onComplete: () => {
            setCount(endVal); // Guarantee hitting target
            
            // Pop scale feedback on finish
            gsap.fromTo(el, 
              { scale: 1 }, 
              { scale: 1.05, duration: 0.15, yoyo: true, repeat: 1, ease: "power1.inOut" }
            );
          }
        });
      },
    });

    return () => {
      trigger.kill();
    };
  }, [endVal, duration, delay]);

  return { count, elementRef };
}

export default useCounter;
