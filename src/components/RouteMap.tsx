import { useEffect, useRef } from "react";

interface Props {
  depot: { lat: number; lon: number };
  dest: { lat: number; lon: number } | null;
  geometry?: [number, number][];
}

/** Leaflet map — imported dynamically so it never runs during SSR. */
export function RouteMap({ depot, dest, geometry }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !ref.current) return;
      if (!mapRef.current) {
        mapRef.current = L.map(ref.current, { zoomControl: false, attributionControl: true });
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap" }).addTo(mapRef.current);
      }
      const map = mapRef.current;
      map.eachLayer((l: any) => { if (!l._url) map.removeLayer(l); });
      const dot = (color: string) => L.divIcon({ className: "", html: `<div style="width:14px;height:14px;border-radius:9999px;background:${color};border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,.3)"></div>` });
      L.marker([depot.lat, depot.lon], { icon: dot("var(--ink)") }).addTo(map).bindTooltip("Depot");
      if (dest) {
        L.marker([dest.lat, dest.lon], { icon: dot("var(--primary)") }).addTo(map).bindTooltip("Venue");
        if (geometry?.length) {
          const line = L.polyline(geometry, { color: getComputedStyle(document.documentElement).getPropertyValue("--primary") || "orange", weight: 4 }).addTo(map);
          map.fitBounds(line.getBounds(), { padding: [20, 20] });
        } else map.fitBounds([[depot.lat, depot.lon], [dest.lat, dest.lon]], { padding: [30, 30] });
      } else map.setView([depot.lat, depot.lon], 11);
    })();
    return () => { cancelled = true; };
  }, [depot.lat, depot.lon, dest?.lat, dest?.lon, geometry]);

  useEffect(() => () => { mapRef.current?.remove(); mapRef.current = null; }, []);

  return <div ref={ref} className="h-56 w-full overflow-hidden rounded-xl border" />;
}
