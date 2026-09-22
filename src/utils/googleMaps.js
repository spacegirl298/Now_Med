// Google Maps JavaScript API loader + helpers (Location & ETA groundwork).
//
// Deliberately uses the classic <script src="maps/api/js?key=...&callback=...">
// approach, not a fetch() to Google's Distance Matrix / Geocoding "Web
// Service" REST endpoints. Those REST endpoints don't send CORS headers -
// a browser fetch() to them fails outright - they're meant to be called
// from a server. This app has no backend, so the Maps JavaScript API
// (this script tag) is Google's actual supported path for a browser-only
// app, and both DistanceMatrixService and Geocoder ship in the default
// bundle - no extra `libraries=` query param needed for either.
//
// loadGoogleMaps() is memoised so the script tag is only ever injected
// once, no matter how many components call it.
let loadPromise = null;

export function loadGoogleMaps() {
  if (loadPromise) return loadPromise;

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return Promise.reject(
      new Error(
        "VITE_GOOGLE_MAPS_API_KEY is not set. Copy .env.example to .env.local and add your key.",
      ),
    );
  }

  if (window.google?.maps) {
    loadPromise = Promise.resolve(window.google.maps);
    return loadPromise;
  }

  loadPromise = new Promise((resolve, reject) => {
    const callbackName = "__nowMedGoogleMapsLoaded";
    window[callbackName] = () => {
      delete window[callbackName];
      resolve(window.google.maps);
    };

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&callback=${callbackName}&loading=async`;
    script.async = true;
    script.onerror = () => {
      loadPromise = null; // let a later call retry instead of staying broken forever
      reject(new Error("Google Maps failed to load."));
    };
    document.head.appendChild(script);
  });

  return loadPromise;
}

// Turns a free-text practice address into { lat, lng }, so the secretary
// can type an address once (SecretaryProfile's doctor form) instead of
// needing to know coordinates. Called on doctor save, not on every page
// load - the result is stored on the doctor doc, not re-geocoded live.
export async function geocodeAddress(address) {
  const maps = await loadGoogleMaps();
  const geocoder = new maps.Geocoder();

  return new Promise((resolve, reject) => {
    geocoder.geocode({ address }, (results, status) => {
      if (status === "OK" && results[0]) {
        const loc = results[0].geometry.location;
        resolve({
          lat: loc.lat(),
          lng: loc.lng(),
          formattedAddress: results[0].formatted_address,
        });
      } else {
        reject(
          new Error(
            status === "ZERO_RESULTS"
              ? "Could not find that address. Try adding more detail (suburb, city)."
              : `Address lookup failed (${status}).`,
          ),
        );
      }
    });
  });
}

// Driving time + distance from the patient's current position to the
// practice. Returns durationMinutes as a plain number (for "leave by"
// math) alongside the human-readable text Google generates.
export async function getDrivingETA({ originLat, originLng, destLat, destLng }) {
  const maps = await loadGoogleMaps();
  const service = new maps.DistanceMatrixService();

  return new Promise((resolve, reject) => {
    service.getDistanceMatrix(
      {
        origins: [{ lat: originLat, lng: originLng }],
        destinations: [{ lat: destLat, lng: destLng }],
        travelMode: maps.TravelMode.DRIVING,
        unitSystem: maps.UnitSystem.METRIC,
      },
      (response, status) => {
        if (status !== "OK") {
          reject(new Error(`Distance Matrix request failed (${status}).`));
          return;
        }
        const element = response.rows[0]?.elements[0];
        if (!element || element.status !== "OK") {
          reject(
            new Error(
              element?.status === "ZERO_RESULTS"
                ? "No driving route found to the practice."
                : "Could not calculate a route to the practice.",
            ),
          );
          return;
        }
        resolve({
          durationMinutes: Math.round(element.duration.value / 60),
          durationText: element.duration.text,
          distanceText: element.distance.text,
          distanceMeters: element.distance.value,
        });
      },
    );
  });
}
