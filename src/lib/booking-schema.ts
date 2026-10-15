import { z } from "zod";

const time = z.string().regex(/^\d{2}:\d{2}$/, "Please pick a time");
const req = (label: string, max = 200) =>
  z.string().trim().min(1, `${label} is required`).max(max, `${label} is too long`);

export const bookingSchema = z
  .object({
    package: z.enum(["afterwork", "custom"]),
    event_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Please pick a date"),
    start_time: time,
    end_time: time,
    venue_name: req("Venue name"),
    address: req("Address", 400),
    town: req("Town (pick an address from the list)"),
    lat: z.number({ message: "Pick an address from the suggestions" }),
    lon: z.number({ message: "Pick an address from the suggestions" }),
    venue_type: z.enum(["public_ground", "private_campus"], { message: "Choose a venue type" }),
    has_400v: z.boolean({ message: "Tell us if 400V power is available" }),
    clearance_m: z.number().min(2, "Clearance looks too low").max(20).nullable(),
    space_m2: z.number({ message: "Enter the space available" }).positive("Space must be more than 0 m²").max(100000),
    guests: z.number({ message: "Enter number of guests" }).int().min(1, "At least 1 guest").max(2000),
    vegan: z.number().int().min(0),
    gluten_free: z.number().int().min(0),
    halal: z.number().int().min(0),
    espresso: z.boolean(),
    company_name: req("Company name"),
    billing_address: req("Billing address", 400),
    po_number: req("PO number (no PO, no booking)", 60),
    contact_name: req("Contact person", 120),
    contact_mobile: z.string().trim().regex(/^\+?[0-9 ()/-]{6,20}$/, "Enter a valid mobile number"),
    approver_name: z.string().trim().max(120).optional().or(z.literal("")),
    approver_email: z.string().trim().email("Enter a valid email").max(255).optional().or(z.literal("")),
  })
  .refine((d) => d.vegan <= d.guests, { path: ["vegan"], message: "Vegan guests can't exceed total guests" })
  .refine((d) => d.gluten_free <= d.guests, { path: ["gluten_free"], message: "Gluten-free guests can't exceed total guests" })
  .refine((d) => d.halal <= d.guests, { path: ["halal"], message: "Halal guests can't exceed total guests" });

export type BookingInput = z.infer<typeof bookingSchema>;
