// Google Maps JavaScript API loader + helpers (Location & ETA groundwork).
//
// Two different approaches are used here, deliberately:
//
// - geocodeAddress() uses the classic <script src="maps/api/js?key=...">
//   Maps JavaScript API bundle and its Geocoder class. The Geocoding API's
//   own REST "Web Service" endpoint doesn't send CORS headers - a browser
//   fetch() to it fails outright, it's meant to be called from a server -
//   so the JS bundle is the actual supported browser-only path for it.
//
// - getDrivingETA() calls the newer Routes API's computeRouteMatrix REST
//   endpoint directly with fetch(). Unlike the legacy Distance Matrix API
//   it replaces, Routes API is built to support both server and browser
//   clients - it does send CORS headers, and Google's own API-key
//   "HTTP referrer (website)" restriction exists specifically to secure
//   calls like this one. So no Maps JS bundle / DistanceMatrixService
//   detour needed for it, and "Distance Matrix API (Legacy)" doesn't need
//   to be enabled on the project at all - just Routes API.
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

// Human-readable formatters - Routes API returns raw seconds/meters, not
// the pre-formatted "text" fields the legacy Distance Matrix API used to.
function formatDurationText(totalMinutes) {
  if (totalMinutes < 60) return `${totalMinutes} min`;
  const hrs = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  return mins === 0 ? `${hrs} hr` : `${hrs} hr ${mins} min`;
}

function formatDistanceText(meters) {
  const km = meters / 1000;
  return km < 1 ? `${meters} m` : `${km.toFixed(1)} km`;
}

// Driving time + distance from the patient's current position to the
// practice, via the Routes API's computeRouteMatrix method. Returns
// durationMinutes as a plain number (for "leave by" math) alongside
// human-readable text we format ourselves.
export async function getDrivingETA({
  originLat,
  originLng,
  destLat,
  destLng,
}) {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    throw new Error(
      "VITE_GOOGLE_MAPS_API_KEY is not set. Copy .env.example to .env.local and add your key.",
    );
  }

  const response = await fetch(
    "https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        // Only ask for the fields we actually use - Routes API bills/limits
        // partly by response size, and "*" is discouraged outside debugging.
        "X-Goog-FieldMask":
          "originIndex,destinationIndex,duration,distanceMeters,condition",
      },
      body: JSON.stringify({
        origins: [
          {
            waypoint: {
              location: {
                latLng: { latitude: originLat, longitude: originLng },
              },
            },
          },
        ],
        destinations: [
          {
            waypoint: {
              location: { latLng: { latitude: destLat, longitude: destLng } },
            },
          },
        ],
        travelMode: "DRIVE",
        routingPreference: "TRAFFIC_AWARE",
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`Routes API request failed (${response.status}).`);
  }

  // With exactly one origin and one destination this is a one-element
  // array (still an array - computeRouteMatrix's REST response is always
  // a list of elements, one per origin/destination pair).
  const elements = await response.json();
  const element = Array.isArray(elements) ? elements[0] : null;

  if (!element || element.condition !== "ROUTE_EXISTS") {
    throw new Error(
      element?.condition === "ROUTE_NOT_FOUND"
        ? "No driving route found to the practice."
        : "Could not calculate a route to the practice.",
    );
  }

  // duration comes back as a protobuf Duration string like "823s".
  const durationMinutes = Math.round(parseInt(element.duration, 10) / 60);

  return {
    durationMinutes,
    durationText: formatDurationText(durationMinutes),
    distanceText: formatDistanceText(element.distanceMeters),
    distanceMeters: element.distanceMeters,
  };
}
