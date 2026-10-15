import { createFileRoute } from "@tanstack/react-router";
import { BookingDetail } from "@/components/BookingDetail";

export const Route = createFileRoute("/_authenticated/bookings/$id")({
  head: () => ({ meta: [{ title: "Booking — TruckOps" }, { name: "description", content: "Booking details, quote and history." }] }),
  component: () => {
    const { id } = Route.useParams();
    return <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6"><BookingDetail id={id} /></main>;
  },
});
