// Google Maps loader

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
      loadPromise = null;
      reject(new Error("Google Maps failed to load."));
    };
    document.head.appendChild(script);
  });

  return loadPromise;
}

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

  const elements = await response.json();
  const element = Array.isArray(elements) ? elements[0] : null;

  if (!element || element.condition !== "ROUTE_EXISTS") {
    throw new Error(
      element?.condition === "ROUTE_NOT_FOUND"
        ? "No driving route found to the practice."
        : "Could not calculate a route to the practice.",
    );
  }

  const durationMinutes = Math.round(parseInt(element.duration, 10) / 60);

  return {
    durationMinutes,
    durationText: formatDurationText(durationMinutes),
    distanceText: formatDistanceText(element.distanceMeters),
    distanceMeters: element.distanceMeters,
  };
}
