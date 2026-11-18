import { useEffect, useRef } from "react";

interface Props {
  depot: { lat: number; lon: number };
  dest: { lat: number; lon: number } | null;
  geometry?: [number, number][];
  labels?: { depot: string; venue: string };
}

/** Leaflet map — imported dynamically so it never runs during SSR. */
export function RouteMap({ depot, dest, geometry, labels }: Props) {
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
      // iconSize matches the drawn dot (border-box), so the dot's centre sits exactly on the coordinate.
      const dot = (color: string, size: number) =>
        L.divIcon({ className: "", iconSize: [size, size], iconAnchor: [size / 2, size / 2], html: `<div style="box-sizing:border-box;width:${size}px;height:${size}px;border-radius:9999px;background:${color};border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,.3)"></div>` });
      L.marker([depot.lat, depot.lon], { icon: dot("var(--ink)", 14) }).addTo(map).bindTooltip(labels?.depot ?? "Depot");
      if (dest) {
        // The venue sits on top, slightly larger, so it stays visible when it is next to the yard.
        L.marker([dest.lat, dest.lon], { icon: dot("var(--primary)", 18), zIndexOffset: 1000 }).addTo(map).bindTooltip(labels?.venue ?? "Venue");
        if (geometry?.length) {
          const line = L.polyline(geometry, { color: getComputedStyle(document.documentElement).getPropertyValue("--primary") || "orange", weight: 4 }).addTo(map);
          map.fitBounds(line.getBounds(), { padding: [20, 20] });
        } else map.fitBounds([[depot.lat, depot.lon], [dest.lat, dest.lon]], { padding: [30, 30] });
      } else map.setView([depot.lat, depot.lon], 11);
    })();
    return () => { cancelled = true; };
  }, [depot.lat, depot.lon, dest?.lat, dest?.lon, geometry, labels?.depot, labels?.venue]);

  useEffect(() => () => { mapRef.current?.remove(); mapRef.current = null; }, []);

  return <div ref={ref} className="h-56 w-full overflow-hidden rounded-xl border" />;
}
