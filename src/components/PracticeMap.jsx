import { useEffect, useRef, useState } from "react";
import { loadGoogleMaps } from "../utils/googleMaps";

export default function PracticeMap({ lat, lng, label }) {
  const mapRef = useRef(null);
  const [error, setError] = useState("");

  // Load map
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
        if (!cancelled) {
          console.error("Map failed to load:", err);
          setError("The map isn't available right now - use the directions link below.");
        }
      });

    return () => {
      cancelled = true;
      if (marker && marker.setMap) marker.setMap(null);
    };
  }, [lat, lng, label]);

  // Render map
  if (lat == null || lng == null) return null;
  if (error) return <p className="text-xs text-slate">{error}</p>;

  return (
    <div
      ref={mapRef}
      className="w-full h-40 rounded-xl overflow-hidden mt-3 bg-mist"
    />
  );
}
