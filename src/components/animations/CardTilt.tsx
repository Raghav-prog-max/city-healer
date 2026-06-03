import React, { useRef } from "react";
import { useMouseTilt } from "../../hooks/useMouseTilt";

interface CardTiltProps {
  children: React.ReactNode;
  className?: string;
  isActive?: boolean;
}

export function CardTilt({
  children,
  className = "",
  isActive = true,
}: CardTiltProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  // Apply our custom 3D mouse tilt tracking hook to this ref
  useMouseTilt(cardRef, isActive);

  return (
    <div
      ref={cardRef}
      className={`relative overflow-hidden transition-shadow duration-300 ${className}`}
      style={{
        transformStyle: "preserve-3d",
      }}
    >
      {/* 3D Inner preserve container */}
      <div style={{ transform: "translateZ(20px)" }} className="h-full w-full">
        {children}
      </div>
    </div>
  );
}

export default CardTilt;
