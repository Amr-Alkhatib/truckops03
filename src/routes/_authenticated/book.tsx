import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { BookingWizard } from "@/components/BookingWizard";

export const Route = createFileRoute("/_authenticated/book")({
  validateSearch: z.object({ package: z.string().max(60).optional() }),
  head: () => ({ meta: [{ title: "New booking — TruckOps" }, { name: "description", content: "Book Rolling Feast food trucks with a live quote." }] }),
  component: BookPage,
});

function BookPage() {
  const search = Route.useSearch();
  return <BookingWizard initialPackage={search.package} />;
}
