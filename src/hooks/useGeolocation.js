import { useState, useCallback } from "react";

export function useGeolocation() {
  const [position, setPosition] = useState(null);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");

  const requestLocation = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setStatus("unsupported");
      setError("Your browser doesn't support location services.");
      return;
    }

    setStatus("loading");
    setError("");

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPosition({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
        setStatus("success");
      },
      (err) => {
        setStatus(err.code === 1 ? "denied" : "error");
        setError(
          err.code === 1
            ? "Location access was denied. Allow it in your browser's site settings to get an ETA."
            : "Could not determine your location right now. Please try again.",
        );
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }, []);

  return { position, status, error, requestLocation };
}
