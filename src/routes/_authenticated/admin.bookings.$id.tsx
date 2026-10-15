import { createFileRoute } from "@tanstack/react-router";
import { BookingDetail } from "@/components/BookingDetail";

export const Route = createFileRoute("/_authenticated/admin/bookings/$id")({
  component: () => <BookingDetail id={Route.useParams().id} />,
});
