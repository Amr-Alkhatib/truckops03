import { useEffect, useRef } from "react";

/** Leaflet map with each yard and its max-distance radius. Leaflet is loaded only in the browser. */
export function YardsMap({ yards, radiusKm }: { yards: { id: string; name: string; lat: number; lon: number; status: string }[]; radiusKm: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const key = JSON.stringify(yards.map((y) => [y.id, y.lat, y.lon, y.status])) + radiusKm;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !ref.current) return;
      if (!mapRef.current) {
        mapRef.current = L.map(ref.current, { zoomControl: true });
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap" }).addTo(mapRef.current);
      }
      const map = mapRef.current;
      map.eachLayer((l: any) => { if (!l._url) map.removeLayer(l); });
      const primary = getComputedStyle(document.documentElement).getPropertyValue("--primary") || "orange";
      const group: any[] = [];
      yards.filter((y) => y.status !== "closed").forEach((y) => {
        const c = L.circle([y.lat, y.lon], { radius: radiusKm * 1000, color: primary, weight: 2, fillOpacity: 0.08 }).addTo(map);
        L.marker([y.lat, y.lon], { icon: L.divIcon({ className: "", html: `<div style="width:16px;height:16px;border-radius:9999px;background:${primary};border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,.3)"></div>` }) })
          .addTo(map)
          .bindTooltip(`${y.name} · ${radiusKm} km`, { permanent: true, direction: "top", offset: [0, -8] });
        group.push(c);
      });
      if (group.length) map.fitBounds(L.featureGroup(group).getBounds(), { padding: [10, 10] });
    })();
    return () => { cancelled = true; };
  }, [key]);

  useEffect(() => () => { mapRef.current?.remove(); mapRef.current = null; }, []);
  return <div ref={ref} className="h-80 w-full overflow-hidden rounded-2xl border" />;
}
