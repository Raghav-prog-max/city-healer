import React from "react";
import { useCounter } from "../../hooks/useCounter";

interface CountUpProps {
  value: number;
  prefix?: string;
  suffix?: string;
  label: string;
  describe?: string;
  icon?: React.ComponentType<any>;
}

export function CountUp({
  value,
  prefix = "",
  suffix = "",
  label,
  describe,
  icon: Icon,
}: CountUpProps) {
  // Leverage our specialized GSAP proxy count-up hook
  const { count, elementRef } = useCounter(value, 2.2);

  return (
    <div
      ref={elementRef as any}
      className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm transition-all duration-500 hover:border-cyan-500/20 hover:shadow-cyan-100/30 hover:shadow-lg"
    >
      {/* Radiant entrance background gradient glow */}
      <div className="absolute -right-16 -top-16 h-32 w-32 rounded-full bg-gradient-to-br from-cyan-400/20 to-emerald-400/20 blur-2xl transition-all duration-700 group-hover:scale-150" />

      <div className="relative z-10 flex flex-col justify-between h-full space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            {label}
          </span>
          {Icon && (
            <div className="rounded-xl bg-slate-50 p-2.5 text-slate-600 transition-colors duration-300 group-hover:bg-cyan-50 group-hover:text-cyan-600">
              <Icon className="h-5 w-5" />
            </div>
          )}
        </div>

        <div>
          <h3 className="font-heading text-4xl font-black tracking-tight text-slate-900 md:text-5xl">
            {prefix}
            <span className="font-mono">{count}</span>
            {suffix}
          </h3>
          {describe && (
            <p className="mt-1 text-xs text-slate-500 line-clamp-2">
              {describe}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default CountUp;
