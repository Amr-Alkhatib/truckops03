// OpenStreetMap helpers: Nominatim geocoding and OSRM road distance.

export interface GeoResult {
  label: string;
  lat: number;
  lon: number;
  town: string;
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
