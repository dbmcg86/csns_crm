"use client";

import * as React from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  CheckCircle2,
  ChevronRight,
  Loader2,
  Building2,
  UserRound,
  Briefcase,
  StickyNote,
  CalendarClock,
} from "lucide-react";

import { intakeSchema, type IntakeInput } from "@/lib/schema";
import {
  REPS,
  INTERACTION_TYPES,
  INDUSTRIES,
  SOURCES,
  TAGS,
  US_STATES,
} from "@/lib/options";
import { clearDraft, loadDraft, saveDraft } from "@/lib/draft";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { NativeSelect } from "@/components/native-select";
import { MultiSelect } from "@/components/multi-select";
import { cn } from "@/lib/utils";

const defaultValues: IntakeInput = {
  rep_name: "",
  interaction_type: "",
  partner_name: "",
  website: "",
  industry_id: "",
  street: "",
  city: "",
  state_id: "",
  zip: "",
  contact_name: "",
  function: "",
  email_from: "",
  phone: "",
  mobile: "",
  source_id: "",
  referred: "",
  expected_revenue: "",
  tag_ids: [],
  date_deadline: "",
  description: "",
};

type FieldProps = {
  label: string;
  htmlFor?: string;
  required?: boolean;
  error?: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
};

function Field({
  label,
  htmlFor,
  required,
  error,
  hint,
  className,
  children,
}: FieldProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      {children}
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

const inputCx = "h-11 text-base";

export function IntakeForm() {
  const [submitted, setSubmitted] = React.useState(false);
  const [submittedPayload, setSubmittedPayload] = React.useState<
    Record<string, unknown> | null
  >(null);

  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<IntakeInput>({
    resolver: zodResolver(intakeSchema),
    defaultValues,
    mode: "onBlur",
  });

  // Restore draft on mount
  React.useEffect(() => {
    const draft = loadDraft<IntakeInput>();
    if (draft) {
      reset({ ...defaultValues, ...draft });
    }
  }, [reset]);

  // Auto-save draft on change (debounced)
  const watched = watch();
  React.useEffect(() => {
    if (submitted) return;
    const t = setTimeout(() => saveDraft(watched), 400);
    return () => clearTimeout(t);
  }, [watched, submitted]);

  const sourceId = watch("source_id");
  const showReferred = sourceId === "referral";

  const onSubmit = async (values: IntakeInput) => {
    const payload = {
      ...values,
      submitted_at: new Date().toISOString(),
    };
    // TODO: POST to Apps Script web app URL once configured.
    // For now, log to console so we can see the shape.
    console.log("Intake submission:", payload);
    await new Promise((r) => setTimeout(r, 600));
    clearDraft();
    setSubmittedPayload(payload);
    setSubmitted(true);
  };

  const startNew = () => {
    reset(defaultValues);
    clearDraft();
    setSubmitted(false);
    setSubmittedPayload(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (submitted) {
    return (
      <Card className="border-emerald-200/50 dark:border-emerald-900/50">
        <CardHeader className="text-center space-y-3">
          <div className="mx-auto h-14 w-14 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
            <CheckCircle2 className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
          </div>
          <CardTitle className="text-xl">Submission logged</CardTitle>
          <CardDescription>
            Saved for{" "}
            <span className="font-medium text-foreground">
              {submittedPayload?.partner_name as string}
            </span>{" "}
            — attributed to{" "}
            <span className="font-medium text-foreground">
              {submittedPayload?.rep_name as string}
            </span>
            .
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row gap-2 justify-center pb-6">
          <Button onClick={startNew} className="h-11">
            Log another
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="h-11"
          >
            Done
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">New customer intro</CardTitle>
          <CardDescription>
            Log who you met, what they need, and the next step.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <Accordion
            multiple
            defaultValue={[
              "visit",
              "company",
              "contact",
              "opportunity",
              "notes",
            ]}
            className="w-full"
          >
            {/* 1. Visit */}
            <AccordionItem value="visit">
              <AccordionTrigger className="text-base font-medium">
                <div className="flex items-center gap-2">
                  <CalendarClock className="h-4 w-4 text-muted-foreground" />
                  Visit
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-2 space-y-4">
                <Field
                  label="Rep"
                  htmlFor="rep_name"
                  required
                  error={errors.rep_name?.message}
                >
                  <NativeSelect
                    id="rep_name"
                    placeholder="Select rep"
                    {...register("rep_name")}
                  >
                    {REPS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>

                <Field
                  label="Interaction type"
                  htmlFor="interaction_type"
                  required
                  error={errors.interaction_type?.message}
                >
                  <NativeSelect
                    id="interaction_type"
                    placeholder="How did you meet?"
                    {...register("interaction_type")}
                  >
                    {INTERACTION_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
              </AccordionContent>
            </AccordionItem>

            {/* 2. Company */}
            <AccordionItem value="company">
              <AccordionTrigger className="text-base font-medium">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  Company
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-2 space-y-4">
                <Field
                  label="Company name"
                  htmlFor="partner_name"
                  required
                  error={errors.partner_name?.message}
                >
                  <Input
                    id="partner_name"
                    autoComplete="organization"
                    className={inputCx}
                    {...register("partner_name")}
                  />
                </Field>

                <Field
                  label="Website"
                  htmlFor="website"
                  error={errors.website?.message}
                  hint="Optional — e.g. https://example.com"
                >
                  <Input
                    id="website"
                    type="url"
                    inputMode="url"
                    autoComplete="url"
                    placeholder="https://"
                    className={inputCx}
                    {...register("website")}
                  />
                </Field>

                <Field label="Industry" htmlFor="industry_id">
                  <NativeSelect
                    id="industry_id"
                    placeholder="Select industry"
                    {...register("industry_id")}
                  >
                    {INDUSTRIES.map((i) => (
                      <option key={i} value={i}>
                        {i}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>

                <Field label="Street" htmlFor="street">
                  <Input
                    id="street"
                    autoComplete="street-address"
                    className={inputCx}
                    {...register("street")}
                  />
                </Field>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="City" htmlFor="city" className="col-span-2">
                    <Input
                      id="city"
                      autoComplete="address-level2"
                      className={inputCx}
                      {...register("city")}
                    />
                  </Field>
                  <Field label="State" htmlFor="state_id">
                    <NativeSelect
                      id="state_id"
                      placeholder="State"
                      {...register("state_id")}
                    >
                      {US_STATES.map(([code, name]) => (
                        <option key={code} value={code}>
                          {code} — {name}
                        </option>
                      ))}
                    </NativeSelect>
                  </Field>
                  <Field label="ZIP" htmlFor="zip">
                    <Input
                      id="zip"
                      inputMode="numeric"
                      autoComplete="postal-code"
                      maxLength={10}
                      className={inputCx}
                      {...register("zip")}
                    />
                  </Field>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* 3. Contact */}
            <AccordionItem value="contact">
              <AccordionTrigger className="text-base font-medium">
                <div className="flex items-center gap-2">
                  <UserRound className="h-4 w-4 text-muted-foreground" />
                  Contact
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-2 space-y-4">
                <Field
                  label="Contact name"
                  htmlFor="contact_name"
                  required
                  error={errors.contact_name?.message}
                >
                  <Input
                    id="contact_name"
                    autoComplete="name"
                    className={inputCx}
                    {...register("contact_name")}
                  />
                </Field>

                <Field label="Title / role" htmlFor="function">
                  <Input
                    id="function"
                    autoComplete="organization-title"
                    className={inputCx}
                    {...register("function")}
                  />
                </Field>

                <Field
                  label="Email"
                  htmlFor="email_from"
                  error={errors.email_from?.message}
                  hint="At least one of email, phone, or mobile is required."
                >
                  <Input
                    id="email_from"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    className={inputCx}
                    {...register("email_from")}
                  />
                </Field>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Phone" htmlFor="phone">
                    <Input
                      id="phone"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      className={inputCx}
                      {...register("phone")}
                    />
                  </Field>
                  <Field label="Mobile" htmlFor="mobile">
                    <Input
                      id="mobile"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      className={inputCx}
                      {...register("mobile")}
                    />
                  </Field>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* 4. Opportunity */}
            <AccordionItem value="opportunity">
              <AccordionTrigger className="text-base font-medium">
                <div className="flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-muted-foreground" />
                  Opportunity
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-2 space-y-4">
                <Field label="Lead source" htmlFor="source_id">
                  <NativeSelect
                    id="source_id"
                    placeholder="How did this lead come in?"
                    {...register("source_id")}
                  >
                    {SOURCES.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>

                {showReferred && (
                  <Field
                    label="Referred by"
                    htmlFor="referred"
                    required
                    error={errors.referred?.message}
                  >
                    <Input
                      id="referred"
                      className={inputCx}
                      {...register("referred")}
                    />
                  </Field>
                )}

                <Field
                  label="Estimated annual value (USD)"
                  htmlFor="expected_revenue"
                  error={errors.expected_revenue?.message}
                  hint="Rough guess. Leave blank if unknown."
                >
                  <Input
                    id="expected_revenue"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step={1000}
                    className={inputCx}
                    {...register("expected_revenue")}
                  />
                </Field>

                <Field label="Interest / product fit" htmlFor="tag_ids">
                  <Controller
                    name="tag_ids"
                    control={control}
                    render={({ field }) => (
                      <MultiSelect
                        id="tag_ids"
                        options={TAGS}
                        value={field.value ?? []}
                        onChange={field.onChange}
                      />
                    )}
                  />
                </Field>

                <Field
                  label="Next-step date"
                  htmlFor="date_deadline"
                  hint="When you plan to follow up."
                >
                  <Input
                    id="date_deadline"
                    type="date"
                    className={inputCx}
                    {...register("date_deadline")}
                  />
                </Field>
              </AccordionContent>
            </AccordionItem>

            {/* 5. Notes */}
            <AccordionItem value="notes" className="border-b-0">
              <AccordionTrigger className="text-base font-medium">
                <div className="flex items-center gap-2">
                  <StickyNote className="h-4 w-4 text-muted-foreground" />
                  Notes
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-2 space-y-4">
                <Field
                  label="Notes from the conversation"
                  htmlFor="description"
                  required
                  error={errors.description?.message}
                  hint="Pain points, products mentioned, anything not captured above."
                >
                  <Textarea
                    id="description"
                    rows={6}
                    className="text-base resize-y min-h-32"
                    {...register("description")}
                  />
                </Field>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

      <div className="sticky bottom-3 z-10">
        <Button
          type="submit"
          disabled={isSubmitting}
          className="w-full h-12 text-base shadow-lg"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Submitting…
            </>
          ) : (
            "Submit intake"
          )}
        </Button>
      </div>

      <p className="text-center text-xs text-muted-foreground pb-4">
        Drafts are auto-saved on this device. Data will migrate to Odoo CRM.
      </p>
    </form>
  );
}
