import type { Quote } from "./engine";
import { eur, formatDateDE } from "./engine";

export interface PdfBooking {
  ref?: string;
  event_date: string;
  start_time: string;
  end_time: string;
  venue_name: string;
  address: string;
  guests: number;
  company_name: string;
  billing_address: string;
  po_number: string;
  contact_name: string;
  distance_km: number;
  distance_method?: string;
  distance_computed_at?: string;
}

export async function downloadQuotePdf(b: PdfBooking, q: Quote) {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const doc = new jsPDF();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("Rolling Feast Event Catering", 14, 20);
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text(`Quote ${b.ref ?? "(preview)"} · issued ${formatDateDE(new Date().toISOString().slice(0, 10))}`, 14, 28);
  const info = [
    `Client: ${b.company_name} · PO ${b.po_number}`,
    `Billing: ${b.billing_address}`,
    `Contact: ${b.contact_name}`,
    `Event: ${formatDateDE(b.event_date)} ${b.start_time.slice(0, 5)}–${b.end_time.slice(0, 5)} · ${b.guests} guests`,
    `Venue: ${b.venue_name}, ${b.address}`,
    `Road distance from depot: ${Number(b.distance_km).toFixed(1)} km${b.distance_method ? ` (${b.distance_method}` : ""}${b.distance_computed_at ? `, ${new Date(b.distance_computed_at).toLocaleString("de-DE")})` : b.distance_method ? ")" : ""}`,
    `Trucks: ${q.trucks.map((t) => t.name).join(", ")}${q.espressoTruckId ? ", Espresso Express" : ""}`,
  ];
  doc.setFontSize(9);
  info.forEach((l, i) => doc.text(doc.splitTextToSize(l, 180), 14, 38 + i * 6));
  autoTable(doc, {
    startY: 84,
    head: [["Item (net)", "VAT", "Net"]],
    body: q.lines.map((l) => [l.label, `${l.vatRate}%`, eur(l.net)]),
    foot: [
      ["Total net", "", eur(q.totalNet)],
      ...q.vat.map((g) => [`VAT ${g.rate}% on ${eur(g.net)}`, "", eur(g.vat)]),
      ["Total gross", "", eur(q.totalGross)],
    ],
    headStyles: { fillColor: [40, 30, 25] },
    footStyles: { fillColor: [245, 238, 228], textColor: [30, 20, 15] },
    styles: { fontSize: 9 },
  });
  doc.setFontSize(8);
  doc.text("All prices net in EUR plus statutory VAT. Permit fees are passed through at cost without VAT.", 14, 285);
  doc.save(`RollingFeast-Quote-${b.ref ?? "preview"}.pdf`);
}
