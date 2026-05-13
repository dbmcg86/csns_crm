import { z } from "zod";

const optionalString = z.string().trim().optional().or(z.literal(""));

export const intakeSchema = z
  .object({
    rep_name: z.string().min(1, "Pick the rep"),
    interaction_type: z.string().min(1, "Pick the interaction type"),

    partner_name: z.string().trim().min(1, "Company name is required"),
    website: optionalString.refine(
      (v) => !v || /^https?:\/\/\S+\.\S+/.test(v),
      "Must start with http:// or https://",
    ),
    industry_id: optionalString,
    street: optionalString,
    city: optionalString,
    state_id: optionalString,
    zip: optionalString,

    contact_name: z.string().trim().min(1, "Contact name is required"),
    function: optionalString,
    email_from: optionalString.refine(
      (v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
      "Invalid email",
    ),
    phone: optionalString,
    mobile: optionalString,

    source_id: optionalString,
    referred: optionalString,
    expected_revenue: z
      .union([z.string(), z.number()])
      .optional()
      .transform((v) => {
        if (v === undefined || v === "" || v === null) return undefined;
        const n = typeof v === "number" ? v : Number(v);
        return Number.isFinite(n) ? n : undefined;
      })
      .pipe(z.number().nonnegative("Must be 0 or greater").optional()),
    tag_ids: z.array(z.string()).default([]),
    date_deadline: optionalString,

    description: z.string().trim().min(1, "Notes are required"),
  })
  .refine(
    (data) =>
      Boolean(data.email_from) || Boolean(data.phone) || Boolean(data.mobile),
    {
      message: "Provide at least one of email, phone, or mobile",
      path: ["email_from"],
    },
  )
  .refine(
    (data) => data.source_id !== "referral" || Boolean(data.referred),
    {
      message: "Required when source is Referral",
      path: ["referred"],
    },
  );

export type IntakeInput = z.input<typeof intakeSchema>;
export type IntakeOutput = z.output<typeof intakeSchema>;
