import React, { useState, useRef, useEffect } from "react";
import { 
  Camera, 
  Upload, 
  Check, 
  AlertCircle, 
  CheckCircle2, 
  Info, 
  Trash2, 
  Sparkles, 
  RefreshCw,
  Eye,
  ShieldCheck,
  AlertTriangle
} from "lucide-react";
import { MedicineProduct } from "../types";
import { MedicineProductImage } from "./MedicineProductImage";

interface MedicationVisualMatcherProps {
  cart: { [id: string]: number };
  medicines: MedicineProduct[];
  cartItemPhotos: { [medId: string]: string };
  onSavePhoto: (medId: string, photoDataUrl: string | null) => void;
  verifiedMatches: { [medId: string]: { color: boolean; shape: boolean; markings: boolean; affirmed: boolean } };
  onUpdateVerification: (medId: string, updates: Partial<{ color: boolean; shape: boolean; markings: boolean; affirmed: boolean }>) => void;
  showToast: (msg: string) => void;
}

export const MedicationVisualMatcher: React.FC<MedicationVisualMatcherProps> = ({
  cart,
  medicines,
  cartItemPhotos,
  onSavePhoto,
  verifiedMatches,
  onUpdateVerification,
  showToast
}) => {
  const [selectedMedId, setSelectedMedId] = useState<string>("");
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const cartMedicines = Object.keys(cart)
    .map(id => medicines.find(m => m.id === id))
    .filter((m): m is MedicineProduct => !!m);

  // Set default selected medicine if empty
  useEffect(() => {
    if (cartMedicines.length > 0 && !selectedMedId) {
      setSelectedMedId(cartMedicines[0].id);
    }
  }, [cartMedicines, selectedMedId]);

  // Clean up camera on change of selection or unmount
  useEffect(() => {
    stopCamera();
    return () => {
      stopCamera();
    };
  }, [selectedMedId]);

  const startCamera = async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: "environment", width: { ideal: 640 }, height: { ideal: 480 } } 
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(err => {
          console.error("Video element play failed:", err);
        });
      }
      setCameraActive(true);
      showToast("Accessing clinical photo verification stream...");
    } catch (err: any) {
      console.error("Medical camera connection error:", err);
      setCameraError(
        "Could not launch camera. Verify browser hardware permissions or try uploading a file."
      );
      showToast("Webcam request declined or unsupported.");
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    try {
      const canvas = document.createElement("canvas");
      canvas.width = videoRef.current.videoWidth || 640;
      canvas.height = videoRef.current.videoHeight || 480;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        
        ctx.setTransform(1, 0, 0, 1, 0, 0);

        const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
        onSavePhoto(selectedMedId, dataUrl);
        stopCamera();
        showToast("Physical medication frame verified and loaded successfully!");
      }
    } catch (err) {
      console.error("Capture failure:", err);
      showToast("Snapshot failed. Try device file upload.");
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const processFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      showToast("Please supply a valid JPG or PNG medication image.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result;
      if (typeof result === "string") {
        onSavePhoto(selectedMedId, result);
        showToast("Visual specification photo loaded successfully!");
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const activeMed = medicines.find(m => m.id === selectedMedId);
  const activePhoto = activeMed ? cartItemPhotos[activeMed.id] : null;
  const activeVerif = activeMed ? (verifiedMatches[activeMed.id] || { color: false, shape: false, markings: false, affirmed: false }) : { color: false, shape: false, markings: false, affirmed: false };

  return (
    <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-6">
      {/* Header Info */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
            <ShieldCheck className="h-4 w-4" />
          </span>
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">
            Patient Medication Visual Verification
          </h3>
        </div>
        <p className="text-slate-500 text-xs leading-relaxed">
          Avoid prescription errors. Upload or snapshot physical pills to match against the clinical registry specs (shape, color, markings) before dispatching your order.
        </p>
      </div>

      {cartMedicines.length === 0 ? (
        <div className="border border-dashed border-slate-200 rounded-2xl p-8 text-center text-slate-400 text-xs space-y-3">
          <Info className="h-8 w-8 mx-auto text-slate-300" />
          <p>Please load medications into your Shopping Basket first to initialize visual matches.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Cart item selector (4 cols) */}
          <div className="lg:col-span-4 space-y-3 max-h-[380px] overflow-y-auto pr-1">
            <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">
              Cart Items Verification Target
            </label>
            <div className="space-y-2">
              {cartMedicines.map((m) => {
                const isSelected = m.id === selectedMedId;
                const photoExists = !!cartItemPhotos[m.id];
                const isAffirmed = verifiedMatches[m.id]?.affirmed;

                return (
                  <button
                    key={m.id}
                    onClick={() => setSelectedMedId(m.id)}
                    className={`w-full text-left p-3 rounded-2xl border transition-all flex flex-col gap-2 cursor-pointer ${
                      isSelected 
                        ? "bg-slate-900 border-slate-900 text-white shadow-md" 
                        : "bg-slate-50 border-slate-100 hover:bg-slate-100 text-slate-800"
                    }`}
                  >
                    <div className="flex justify-between items-start w-full">
                      <span className="font-extrabold text-[11px] truncate max-w-[140px]">
                        {m.name}
                      </span>
                      <span className={`text-[9px] font-mono shrink-0 px-2 py-0.5 rounded ${
                        isSelected ? "bg-white/20 text-white" : "bg-slate-200 text-slate-600"
                      }`}>
                        {m.dosageForm}
                      </span>
                    </div>

                    <div className="flex items-center justify-between w-full text-[9px] font-semibold mt-1">
                      <div className="flex items-center gap-1">
                        {photoExists ? (
                          <span className={`px-1.5 py-0.5 rounded flex items-center gap-1 ${
                            isSelected ? "bg-cyan-500/30 text-cyan-200" : "bg-cyan-100 text-cyan-700"
                          }`}>
                            <Camera className="h-2.5 w-2.5" /> Photo Linked
                          </span>
                        ) : (
                          <span className="text-slate-400">No Image Reference</span>
                        )}
                      </div>
                      
                      {isAffirmed ? (
                        <span className={`flex items-center gap-0.5 ${
                          isSelected ? "text-emerald-300 font-extrabold" : "text-emerald-600 font-extrabold"
                        }`}>
                          <CheckCircle2 className="h-3 w-3 inline" /> Verified
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">Unverified</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Verification Workspace (8 cols) */}
          <div className="lg:col-span-8 border border-slate-150 rounded-2xl p-4 bg-slate-50/50 space-y-4">
            {activeMed ? (
              <>
                {/* Medicine info tag */}
                <div className="bg-white border border-slate-150 rounded-xl p-3 flex justify-between items-center shadow-xs">
                  <div>
                    <h4 className="text-xs font-extrabold text-slate-800">{activeMed.name}</h4>
                    <p className="text-[10px] text-slate-400 font-medium">Matching specifications for safety verification</p>
                  </div>
                  <span className="px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg text-[9px] font-black tracking-wider uppercase">
                    {activeMed.category}
                  </span>
                </div>

                {/* Side-by-side workspace comparison */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  
                  {/* Left: Standard Specifications info */}
                  <div className="bg-white border border-slate-150 rounded-xl p-3.5 space-y-3.5 flex flex-col justify-between">
                    <div>
                      <span className="text-[10px] font-black uppercase text-blue-600 bg-blue-50/70 px-2 py-0.5 rounded-md tracking-wider">
                        Official Spec Standard
                      </span>
                      <p className="text-[10px] text-slate-400 font-medium mt-1">Official pharmaceutical registry identity</p>
                    </div>

                    {/* Standard Image Viewport */}
                    <div className="relative">
                      <MedicineProductImage
                        imageUrl={activeMed.imageUrl}
                        name={activeMed.name}
                        pillsColor={activeMed.pillsColor}
                        pillsShape={activeMed.pillsShape}
                        pillsMarkings={activeMed.pillsMarkings}
                        dosageForm={activeMed.dosageForm}
                        category={activeMed.category}
                        requiresPrescription={activeMed.requiresPrescription}
                        aspectRatio="video"
                      />
                    </div>

                    {/* Meta Spec Tags */}
                    <div className="space-y-1.5 text-[10px] bg-slate-50 p-2.5 rounded-lg border border-slate-100 font-semibold text-slate-700">
                      <div className="flex justify-between border-b border-slate-200/60 pb-1">
                        <span className="text-slate-400">Pill Color:</span>
                        <span className="text-slate-800 font-bold">{activeMed.pillsColor || "Color Spec Pending"}</span>
                      </div>
                      <div className="flex justify-between border-b border-slate-200/60 pb-1">
                        <span className="text-slate-400">Pill Shape:</span>
                        <span className="text-slate-800 font-bold">{activeMed.pillsShape || "Shape Spec Pending"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Imprint markings:</span>
                        <span className="text-slate-800 font-mono font-bold text-[9px] bg-sky-50 text-sky-800 px-1 rounded truncate max-w-[110px]">
                          {activeMed.pillsMarkings || "None / Smooth"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Captured Image Viewport */}
                  <div className="bg-white border border-slate-150 rounded-xl p-3.5 flex flex-col justify-between space-y-3.5 relative">
                    <div className="flex justify-between items-center bg-transparent">
                      <span className="text-[10px] font-black uppercase text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md tracking-wider">
                        Patient Physical Pill
                      </span>
                      {activePhoto && (
                        <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                      )}
                    </div>

                    {/* Action Panel: Photo displays or Cameras streams */}
                    <div className="h-28 w-full bg-slate-50 border border-slate-100 rounded-xl relative overflow-hidden flex items-center justify-center">
                      
                      {cameraActive ? (
                        <div className="absolute inset-0 bg-black flex items-center justify-center">
                          <video 
                            ref={videoRef}
                            playsInline
                            muted
                            className="w-full h-full object-cover"
                          />
                          {/* Live Scan overlay reticle lines */}
                          <div className="absolute inset-0 border-2 border-cyan-400/40 m-4 rounded flex items-center justify-center pointer-events-none">
                            <div className="w-16 h-8 border border-dashed border-cyan-400 animate-pulse rounded-md" />
                            <span className="absolute bottom-1 bg-black/70 text-[8px] text-cyan-300 font-mono px-2 py-0.5 tracking-wider uppercase rounded">
                              Aim Reticle Target
                            </span>
                          </div>
                        </div>
                      ) : activePhoto ? (
                        <img 
                          src={activePhoto} 
                          alt="Captured physical drug" 
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div 
                          onDragOver={handleDragOver}
                          onDragLeave={handleDragLeave}
                          onDrop={handleDrop}
                          className={`absolute inset-0 flex flex-col items-center justify-center p-3 text-center space-y-2 cursor-pointer transition-colors ${
                            isDragging ? "bg-blue-50/50 border-2 border-dashed border-blue-400" : ""
                          }`}
                          onClick={() => fileInputRef.current?.click()}
                        >
                          <Camera className="h-7 w-7 text-slate-300 group-hover:text-slate-400" />
                          <div className="space-y-0.5">
                            <p className="text-[10px] font-extrabold text-slate-600">Drag pill photo or Click to select</p>
                            <p className="text-[8px] text-slate-400">Supports webcam captures & device files</p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Hidden Inputs for handling files */}
                    <input 
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileUpload}
                      accept="image/*"
                      className="hidden"
                    />

                    {/* Camera and Upload Action buttons */}
                    <div className="flex gap-2">
                      {cameraActive ? (
                        <>
                          <button
                            type="button"
                            onClick={capturePhoto}
                            className="flex-1 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-[9px] font-extrabold uppercase flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all text-center cursor-pointer"
                          >
                            <Check className="h-3 w-3" /> Snap Pill
                          </button>
                          <button
                            type="button"
                            onClick={stopCamera}
                            className="px-2.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-[9px] font-extrabold uppercase text-center cursor-pointer"
                          >
                            Cancel
                          </button>
                        </>
                      ) : activePhoto ? (
                        <div className="flex w-full gap-2 bg-transparent">
                          <button
                            type="button"
                            onClick={startCamera}
                            className="flex-1 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-[9px] font-extrabold rounded-lg flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <RefreshCw className="h-2.5 w-2.5" /> Retake Frame
                          </button>
                          <button
                            type="button"
                            onClick={() => onSavePhoto(selectedMedId, null)}
                            className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg flex items-center justify-center cursor-pointer"
                            title="Remove visual medication reference"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={startCamera}
                            className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-[9px] font-extrabold uppercase flex items-center justify-center gap-1 active:scale-95 transition-all text-center cursor-pointer"
                          >
                            <Camera className="h-3 w-3" /> Capture Live Pill
                          </button>
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-[9px] font-extrabold uppercase flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <Upload className="h-3 w-3" /> Upload file
                          </button>
                        </>
                      )}
                    </div>

                    {cameraError && (
                      <p className="absolute -bottom-7 left-0 right-0 text-[8px] text-rose-500 text-center font-bold">
                        {cameraError}
                      </p>
                    )}
                  </div>

                </div>

                {/* Attribute Match-Checks & Validation Affirmation */}
                <div className="bg-white border border-slate-150 rounded-xl p-4 space-y-4">
                  <div className="flex items-center gap-1 bg-transparent">
                    <Sparkles className="h-3.5 w-3.5 text-blue-500 animate-pulse" />
                    <span className="text-[10px] font-[900] text-slate-800 uppercase tracking-wider">
                      Physical Verification Attributes Checklist
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {/* Check 1: Color */}
                    <button
                      type="button"
                      disabled={!activePhoto}
                      onClick={() => onUpdateVerification(selectedMedId, { color: !activeVerif.color })}
                      className={`p-2.5 rounded-xl border text-left flex items-start gap-2.5 transition-all cursor-pointer ${
                        !activePhoto ? "opacity-50 cursor-not-allowed bg-slate-50 border-slate-200" :
                        activeVerif.color ? "bg-emerald-50/50 border-emerald-200 text-emerald-900" : "bg-slate-50/50 hover:bg-slate-50 border-slate-150 text-slate-600"
                      }`}
                    >
                      <div className={`mt-0.5 w-4 h-4 rounded flex items-center justify-center border transition-all ${
                        activeVerif.color ? "bg-emerald-500 border-emerald-500 text-white" : "border-slate-300 bg-white"
                      }`}>
                        {activeVerif.color && <Check className="h-3 w-3 block" />}
                      </div>
                      <div>
                        <p className="text-[10px] font-extrabold">Color Validation</p>
                        <p className="text-[9px] text-slate-400 font-medium">Physically white/peach/cream</p>
                      </div>
                    </button>

                    {/* Check 2: Shape */}
                    <button
                      type="button"
                      disabled={!activePhoto}
                      onClick={() => onUpdateVerification(selectedMedId, { shape: !activeVerif.shape })}
                      className={`p-2.5 rounded-xl border text-left flex items-start gap-2.5 transition-all cursor-pointer ${
                        !activePhoto ? "opacity-50 cursor-not-allowed bg-slate-50 border-slate-200" :
                        activeVerif.shape ? "bg-emerald-50/50 border-emerald-200 text-emerald-900" : "bg-slate-50/50 hover:bg-slate-50 border-slate-150 text-slate-600"
                      }`}
                    >
                      <div className={`mt-0.5 w-4 h-4 rounded flex items-center justify-center border transition-all ${
                        activeVerif.shape ? "bg-emerald-500 border-emerald-500 text-white" : "border-slate-300 bg-white"
                      }`}>
                        {activeVerif.shape && <Check className="h-3 w-3 block" />}
                      </div>
                      <div>
                        <p className="text-[10px] font-extrabold">Shape Match</p>
                        <p className="text-[9px] text-slate-400 font-medium">Matched round/oval/oblong</p>
                      </div>
                    </button>

                    {/* Check 3: Markings */}
                    <button
                      type="button"
                      disabled={!activePhoto}
                      onClick={() => onUpdateVerification(selectedMedId, { markings: !activeVerif.markings })}
                      className={`p-2.5 rounded-xl border text-left flex items-start gap-2.5 transition-all cursor-pointer ${
                        !activePhoto ? "opacity-50 cursor-not-allowed bg-slate-50 border-slate-200" :
                        activeVerif.markings ? "bg-emerald-50/50 border-emerald-200 text-emerald-900" : "bg-slate-50/50 hover:bg-slate-50 border-slate-150 text-slate-600"
                      }`}
                    >
                      <div className={`mt-0.5 w-4 h-4 rounded flex items-center justify-center border transition-all ${
                        activeVerif.markings ? "bg-emerald-500 border-emerald-500 text-white" : "border-slate-300 bg-white"
                      }`}>
                        {activeVerif.markings && <Check className="h-3 w-3 block" />}
                      </div>
                      <div>
                        <p className="text-[10px] font-extrabold">Markings Match</p>
                        <p className="text-[9px] text-slate-400 font-medium">Verified letters/scores printed</p>
                      </div>
                    </button>
                  </div>

                  {/* Safety Assurance Check and Status Alert */}
                  <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-3.5 bg-slate-50 rounded-xl border border-slate-150/70">
                    <div className="flex gap-2.5 items-start bg-transparent">
                      <AlertCircle className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                      <div className="text-[10px] text-slate-500 leading-relaxed font-semibold">
                        <span className="font-extrabold text-slate-800 block">Verify with confidence</span>
                        Once physical and standard characteristics match, lock the affirmation to tag this item as verified.
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={!activePhoto}
                      onClick={() => {
                        const nextAffirmed = !activeVerif.affirmed;
                        onUpdateVerification(selectedMedId, { affirmed: nextAffirmed });
                        if (nextAffirmed) {
                          showToast(`Affirmed visual matched safe checklist for: ${activeMed.name}`);
                        }
                      }}
                      className={`w-full md:w-auto px-4 py-2 text-[10px] font-[900] uppercase tracking-wider rounded-xl transition-all shadow-xs shrink-0 cursor-pointer ${
                        !activePhoto ? "bg-slate-200 text-slate-400 cursor-not-allowed" :
                        activeVerif.affirmed 
                          ? "bg-emerald-600 hover:bg-emerald-500 text-white" 
                          : "bg-slate-900 hover:bg-slate-800 text-white"
                      }`}
                    >
                      {activeVerif.affirmed ? "✓ Visual match affirmed" : "Affirm Visual Match"}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="h-64 flex flex-col items-center justify-center text-slate-400 text-xs text-center space-y-2">
                <Info className="h-8 w-8 text-slate-300" />
                <p>Loading Workspace parameters...</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
