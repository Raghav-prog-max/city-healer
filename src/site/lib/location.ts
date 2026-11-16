/**
 * Location, only with consent. The browser prompt is shown only after the user presses a
 * "Share location" button that says what it is for; the choice is remembered (same key as
 * the older screens), and nothing is invented when it is refused.
 */
import { useCallback, useEffect, useState } from "react";

const CHOICE_KEY = "city_healer_location_choice";

/** City centres for the Delhi NCR launch cities (city names as stored at onboarding). Used to sort
 *  care from the patient's chosen city when they have not shared their exact location. */
export const CITY_CENTRES: Record<string, Coords> = {
  Delhi: { lat: 28.6139, lng: 77.209 },
  Gurugram: { lat: 28.4595, lng: 77.0266 },
  Noida: { lat: 28.5355, lng: 77.391 },
  "Greater Noida": { lat: 28.4744, lng: 77.504 },
  Ghaziabad: { lat: 28.6692, lng: 77.4538 },
  Faridabad: { lat: 28.4089, lng: 77.3178 },
};

export type LocationStatus = "unknown" | "locating" | "granted" | "denied" | "unavailable";
export interface Coords { lat: number; lng: number }

let cached: Coords | null = null;
const listeners = new Set<(c: Coords | null) => void>();

function readChoice(): string | null {
  try { return localStorage.getItem(CHOICE_KEY); } catch { return null; }
}
function writeChoice(v: string | null) {
  try { v ? localStorage.setItem(CHOICE_KEY, v) : localStorage.removeItem(CHOICE_KEY); } catch {}
}

export function useLocationConsent() {
  const [coords, setCoords] = useState<Coords | null>(cached);
  const [status, setStatus] = useState<LocationStatus>(cached ? "granted" : readChoice() === "denied" ? "denied" : "unknown");

  useEffect(() => {
    const l = (c: Coords | null) => { setCoords(c); setStatus(c ? "granted" : "unknown"); };
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);

  const locate = useCallback(() => {
    if (!("geolocation" in navigator)) { setStatus("unavailable"); return; }
    setStatus("locating");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        cached = { lat: p.coords.latitude, lng: p.coords.longitude };
        writeChoice("granted");
        listeners.forEach((f) => f(cached));
      },
      (err) => {
        writeChoice(err.code === err.PERMISSION_DENIED ? "denied" : null);
        setStatus(err.code === err.PERMISSION_DENIED ? "denied" : "unavailable");
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 5 * 60 * 1000 },
    );
  }, []);

  // A previous "yes" is honoured silently; anything else waits for the button.
  useEffect(() => {
    if (!cached && readChoice() === "granted") locate();
  }, [locate]);

  const revoke = useCallback(() => {
    cached = null;
    writeChoice("denied");
    listeners.forEach((f) => f(null));
    setStatus("denied");
  }, []);

  return { coords, status, locate, revoke };
}
