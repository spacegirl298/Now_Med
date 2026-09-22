// Small embedded map for a practice location, shown wherever we already
// have doctor.lat/lng (see PatientETA - same coordinates set by the
// secretary's address geocode). Reuses loadGoogleMaps() from utils/googleMaps
// so no second script tag gets injected.
import { useEffect, useRef, useState } from "react";
import { loadGoogleMaps } from "../utils/googleMaps";

export default function PracticeMap({ lat, lng, label }) {
  const mapRef = useRef(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (lat == null || lng == null) return;
    let cancelled = false;
    let marker = null;

    loadGoogleMaps()
      .then((maps) => {
        if (cancelled || !mapRef.current) return;
        const map = new maps.Map(mapRef.current, {
          center: { lat, lng },
          zoom: 15,
          disableDefaultUI: true,
          zoomControl: true,
          gestureHandling: "cooperative",
        });

        if (maps.marker?.AdvancedMarkerElement) {
          marker = new maps.marker.AdvancedMarkerElement({
            position: { lat, lng },
            map,
            title: label,
          });
        } else {
          marker = new maps.Marker({
            position: { lat, lng },
            map,
            title: label,
          });
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "Could not load the map.");
      });

    return () => {
      cancelled = true;
      if (marker && marker.setMap) marker.setMap(null);
    };
  }, [lat, lng, label]);

  if (lat == null || lng == null) return null;
  if (error) return <p className="text-xs text-slate">{error}</p>;

  return (
    <div
      ref={mapRef}
      className="w-full h-40 rounded-xl overflow-hidden mt-3 bg-mist"
    />
  );
}
