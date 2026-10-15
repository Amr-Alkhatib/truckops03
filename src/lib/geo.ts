// OpenStreetMap helpers: Nominatim geocoding and OSRM road distance.

export interface GeoResult {
  label: string;
  lat: number;
  lon: number;
  town: string;
  county: string;
  state: string;
}

export async function searchAddress(q: string, signal?: AbortSignal): Promise<GeoResult[]> {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&countrycodes=de&limit=6&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { signal, headers: { "Accept-Language": "de" } });
  if (!res.ok) throw new Error("Address search unavailable");
  const data = (await res.json()) as any[];
  return data.map((d) => ({
    label: d.display_name,
    lat: Number(d.lat),
    lon: Number(d.lon),
    town: d.address?.city || d.address?.town || d.address?.village || d.address?.municipality || "",
    county: d.address?.county || d.address?.city_district || "",
    state: d.address?.state || "",
  }));
}

export interface RouteResult {
  km: number;
  geometry: [number, number][]; // [lat, lon]
  method: string;
}

export async function roadDistance(
  from: { lat: number; lon: number },
  to: { lat: number; lon: number },
): Promise<RouteResult> {
  const url = `https://router.project-osrm.org/route/v1/driving/${from.lon},${from.lat};${to.lon},${to.lat}?overview=full&geometries=geojson`;
  const res = await fetch(url, { headers: { "User-Agent": "TruckOps/1.0 (Rolling Feast Event Catering)" } });
  if (!res.ok) throw new Error("Road distance service unavailable");
  const data = (await res.json()) as any;
  const route = data.routes?.[0];
  if (!route) throw new Error("No road route found to this address");
  return {
    km: Math.round(route.distance / 10) / 100,
    geometry: (route.geometry.coordinates as [number, number][]).map(([lon, lat]) => [lat, lon]),
    method: "OSRM driving route (router.project-osrm.org, OpenStreetMap)",
  };
}

/**
 * HGV route check with a vehicle height restriction (OpenRouteService driving-hgv).
 * Returns null when no API key is configured.
 */
export async function hgvHeightRoute(
  apiKey: string | undefined,
  from: { lat: number; lon: number },
  to: { lat: number; lon: number },
  heightM: number,
): Promise<{ ok: boolean; km: number | null; note: string } | null> {
  if (!apiKey) return null;
  try {
    const res = await fetch("https://api.openrouteservice.org/v2/directions/driving-hgv", {
      method: "POST",
      headers: { Authorization: apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        coordinates: [[from.lon, from.lat], [to.lon, to.lat]],
        options: { vehicle_type: "hgv", profile_params: { restrictions: { height: heightM } } },
      }),
    });
    if (!res.ok) return { ok: false, km: null, note: `HGV route request failed (${res.status})` };
    const data = (await res.json()) as any;
    const m = data.routes?.[0]?.summary?.distance;
    if (m == null) return { ok: false, km: null, note: "No HGV route found for this height" };
    return { ok: true, km: Math.round(m / 10) / 100, note: `HGV route (height ${heightM} m) found: ${(m / 1000).toFixed(1)} km` };
  } catch {
    return { ok: false, km: null, note: "HGV route service unavailable" };
  }
}
