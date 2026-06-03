import React, { useState } from "react";
import { Search, Sparkles } from "lucide-react";

interface MedicineProductImageProps {
  imageUrl?: string;
  name: string;
  pillsColor?: string;
  pillsShape?: string;
  pillsMarkings?: string;
  dosageForm?: string;
  category?: string;
  requiresPrescription?: boolean;
  onVerifyClick?: () => void;
  aspectRatio?: "square" | "video";
}

export const MedicineProductImage: React.FC<MedicineProductImageProps> = ({
  imageUrl,
  name,
  pillsColor = "White",
  pillsShape = "Round",
  pillsMarkings,
  dosageForm = "Tablet",
  category,
  requiresPrescription = false,
  onVerifyClick,
  aspectRatio = "video"
}) => {
  const [hasError, setHasError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  // Parse color mapping for beautiful custom rendering of fallback pills
  const getColorStyle = (colorStr: string) => {
    const s = colorStr.toLowerCase();
    if (s.includes("pink")) {
      return { pillBg: "bg-pink-400 text-pink-900 border-pink-500/30", parentBg: "from-pink-50 to-rose-50/40", border: "border-pink-100" };
    }
    if (s.includes("orange") || s.includes("peach")) {
      return { pillBg: "bg-orange-400 text-orange-950 border-orange-500/30", parentBg: "from-orange-50 to-amber-50/40", border: "border-orange-100" };
    }
    if (s.includes("yellow") || s.includes("lemon")) {
      return { pillBg: "bg-yellow-300 text-yellow-950 border-yellow-400/30", parentBg: "from-yellow-50 to-amber-50/30", border: "border-yellow-100" };
    }
    if (s.includes("blue")) {
      return { pillBg: "bg-blue-400 text-blue-950 border-blue-500/30", parentBg: "from-blue-50/80 to-indigo-50/30", border: "border-blue-100" };
    }
    if (s.includes("green")) {
      return { pillBg: "bg-emerald-400 text-emerald-950 border-emerald-500/30", parentBg: "from-emerald-50/80 to-teal-50/30", border: "border-emerald-100" };
    }
    if (s.includes("brown")) {
      return { pillBg: "bg-amber-800 text-amber-100 border-amber-900/30", parentBg: "from-amber-50 to-orange-50/20", border: "border-amber-200/50" };
    }
    if (s.includes("red") || s.includes("black")) {
      // dual or dark capsules
      if (s.includes("red") && s.includes("black")) {
        return { pillBg: "bg-gradient-to-r from-red-600 via-red-600 to-slate-900 text-white border-red-700/30", parentBg: "from-red-50/40 to-slate-50", border: "border-slate-200/60" };
      }
      if (s.includes("red")) {
        return { pillBg: "bg-red-500 text-white border-red-600/30", parentBg: "from-red-50 to-rose-50/45", border: "border-red-100" };
      }
      return { pillBg: "bg-slate-700 text-white border-slate-800", parentBg: "from-slate-50 to-slate-100", border: "border-slate-200" };
    }
    // Default / white pill standard look
    return { pillBg: "bg-white text-slate-700 border-slate-300 shadow-sm", parentBg: "from-slate-50/80 to-slate-100/40", border: "border-slate-200/60" };
  };

  const currentTheme = getColorStyle(pillsColor);

  // Render Pill Graphic based on shape specifications
  const renderPillGraphic = () => {
    const shape = pillsShape.toLowerCase();
    const isOblong = shape.includes("oval") || shape.includes("oblong") || shape.includes("capsule") || shape.includes("tablet") && shape.includes("oblong");
    const isTubeOrBottle = shape.includes("tube") || shape.includes("bottle") || dosageForm.toLowerCase().includes("syrup") || dosageForm.toLowerCase().includes("gel");

    if (isTubeOrBottle) {
      return (
        <div className="relative w-10 h-16 bg-slate-100 border border-slate-300 rounded-lg flex flex-col items-center justify-between shadow-sm py-1.5 overflow-hidden">
          <div className="w-6 h-2.5 bg-blue-500 rounded-sm shadow-inner" />
          <div className="w-8 h-8 bg-blue-100/60 rounded-md border border-blue-200 flex items-center justify-center">
            <span className="text-[7.5px] font-black text-blue-800 font-mono">Rx</span>
          </div>
          <div className="w-full text-center text-[7px] font-bold text-slate-500 tracking-tighter uppercase truncate px-0.5">
            {dosageForm}
          </div>
        </div>
      );
    }

    if (isOblong) {
      return (
        <div className={`relative w-20 h-10 rounded-full border flex items-center justify-center overflow-hidden shadow-sm ${currentTheme.pillBg} transition-all duration-300 group-hover:scale-105`}>
          {/* Capsule middle join line */}
          <div className="absolute inset-y-0 left-1/2 -ml-px w-0.5 bg-slate-300/40" />
          {pillsColor.toLowerCase().includes("red and black") && (
            <div className="absolute inset-y-0 right-0 left-1/2 bg-slate-900 pointer-events-none" />
          )}
          {pillsColor.toLowerCase().includes("yellow and green") && (
            <div className="absolute inset-y-0 right-0 left-1/2 bg-emerald-500 pointer-events-none" />
          )}
          {pillsColor.toLowerCase().includes("yellow and white") && (
            <div className="absolute inset-y-0 right-0 left-1/2 bg-white pointer-events-none" />
          )}
          {pillsColor.toLowerCase().includes("green and grey") && (
            <div className="absolute inset-y-0 right-0 left-1/2 bg-slate-400 pointer-events-none" />
          )}
          
          <span className="relative z-10 text-[9px] font-black font-mono tracking-widest uppercase drop-shadow-xs truncate max-w-[80%] opacity-90">
            {pillsMarkings && pillsMarkings !== "N/A" ? pillsMarkings : "Rx"}
          </span>
        </div>
      );
    }

    // Default round
    return (
      <div className={`relative w-14 h-14 rounded-full border flex items-center justify-center overflow-hidden shadow-sm ${currentTheme.pillBg} transition-all duration-300 group-hover:scale-105`}>
        {/* Scored line down the middle */}
        <div className="absolute inset-x-0 top-1/2 -mt-px h-0.5 bg-slate-300/30" />
        <span className="relative z-10 text-[9px] font-black font-mono tracking-widest uppercase truncate max-w-[90%] opacity-90">
          {pillsMarkings && pillsMarkings !== "N/A" ? pillsMarkings : "Rx"}
        </span>
      </div>
    );
  };

  const displayFallback = !imageUrl || hasError;

  return (
    <div 
      className={`relative w-full overflow-hidden rounded-2xl border ${
        displayFallback ? `${currentTheme.border} bg-gradient-to-tr ${currentTheme.parentBg}` : "bg-white border-slate-200/80"
      } flex items-center justify-center group ${aspectRatio === "video" ? "h-40" : "aspect-square"}`}
    >
      {/* Real Netmeds Image */}
      {imageUrl && !hasError && (
        <div className="w-full h-full relative flex items-center justify-center bg-white p-3">
          {/* Skeleton Loader during fetch */}
          {!isLoaded && (
            <div className="absolute inset-0 bg-slate-100/70 animate-pulse flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-slate-300 animate-spin" />
            </div>
          )}
          <img 
            src={imageUrl} 
            alt={name} 
            referrerPolicy="no-referrer"
            onLoad={() => setIsLoaded(true)}
            onError={() => {
              setHasError(true);
              setIsLoaded(true);
            }}
            className={`max-w-full max-h-full object-contain p-2 select-none transition-all duration-500 ${
              isLoaded ? "opacity-100 scale-100" : "opacity-0 scale-95"
            } group-hover:scale-105`}
          />
        </div>
      )}

      {/* High-fidelity custom illustration fallback */}
      {displayFallback && (
        <div className="flex flex-col items-center justify-center p-4 text-center cursor-default animate-fade-in select-none">
          {renderPillGraphic()}
          <span className="text-[10px] font-black text-slate-800 uppercase tracking-wider mt-3 leading-none truncate max-w-[180px]">
            {dosageForm} Speciations
          </span>
          <p className="text-[9.5px] text-slate-500 mt-1 font-semibold truncate max-w-[170px]">
            {pillsColor} • {pillsShape}
          </p>
        </div>
      )}

      {/* Floating Verify Pill trigger button */}
      {onVerifyClick && (
        <div className="absolute top-2 right-2 z-20">
          <button 
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onVerifyClick();
            }}
            className="p-1 px-2.5 rounded-lg bg-white/95 hover:bg-white text-blue-600 shadow-sm border border-slate-100 active:scale-95 transition-all flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider cursor-pointer font-sans"
          >
            <Search className="h-2.5 w-2.5" /> Verify Pill
          </button>
        </div>
      )}

      {/* Bottom informational meta brand tag on display cover */}
      <div className="absolute bottom-2 left-2 px-2 py-0.5 bg-slate-900/40 backdrop-blur-xs rounded-md text-[8.5px] font-bold text-white tracking-wide uppercase flex items-center gap-1">
        {category === "VITAMINS" && <span className="w-1.5 h-1.5 bg-amber-400 rounded-full" />}
        {category === "PAINKILLER" && <span className="w-1.5 h-1.5 bg-rose-400 rounded-full" />}
        {category === "ANTIBIOTIC" && <span className="w-1.5 h-1.5 bg-blue-400 rounded-full" />}
        {category === "CARDIO" && <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />}
        {category === "CHRONIC" && <span className="w-1.5 h-1.5 bg-violet-400 rounded-full" />}
        {category === "FIRST_AID" && <span className="w-1.5 h-1.5 bg-slate-400 rounded-full" />}
        <span>REFERENCE SIG</span>
      </div>
    </div>
  );
};
