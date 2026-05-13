# Central Service & Supply — CRM Intake Form PRD

**Owner:** Dan McGuire
**Date:** 2026-05-12
**Status:** Draft v1

## 1. Background

Central Service & Supply (CnS) is building a custom Odoo ERP instance with CRM built in. That work is in progress and not yet ready for sales-team use. Meanwhile, a wave of new sales reps is starting, and they need a clean, fast way to log information gathered during introductory customer conversations.

This form is an explicit **stopgap**: low-investment, easy to deploy, designed so the data it captures imports cleanly into Odoo CRM (`crm.lead` / `res.partner`) once that platform goes live.

## 2. Goals

1. Give new reps a frictionless way to log customer-intro details from their phone, on the spot.
2. Standardize what gets captured so the data is usable — not free-text chaos.
3. Land submissions in a single Google Sheet that can be exported / imported into Odoo with minimal cleanup.
4. Look polished enough that reps feel good using it in front of (or right after) a customer.

## 3. Non-goals

- Not a public-facing lead-capture form. Reps fill it out, not customers.
- No authentication, no per-user accounts. Shared link only.
- No pipeline management, no opportunity stages, no reporting dashboards. That's Odoo's job.
- No edit/delete flow in v1. Append-only.
- No file/photo attachments in v1.

## 4. Users

- **Primary:** Central Service & Supply sales reps (new hires, plus existing reps as a backup logging tool).
- **Secondary:** Sales manager / ops — pulls the Sheet, reviews submissions, eventually triggers Odoo import.

## 5. User flow

1. Rep finishes an intro call/visit.
2. Opens the form link (bookmarked on phone home screen).
3. Picks own name from a **Rep** dropdown.
4. Fills in the customer fields (mostly tap-friendly inputs; minimal typing).
5. Taps **Submit** → confirmation screen with "Log another" button.
6. Row appended to the Google Sheet, timestamped, attributed to the selected rep.

## 6. Form fields

Field set is modeled on Odoo `crm.lead` defaults so import maps 1:1 later. Required fields marked **\***.

### Rep & meta
| Field | Type | Odoo target | Notes |
|---|---|---|---|
| Rep name **\*** | Dropdown | `user_id` | Populated live from the `Reps` tab of the Sheet via Apps Script — add/rename/remove a rep by editing a single cell, no redeploy required. Starting with 6 slots. |
| Submission date | Auto | `create_date` | Server-side timestamp. |
| Interaction type | Dropdown | `medium_id` | In-person visit / Phone / Email / Trade show / Other. |

### Company (maps to `res.partner` company record)
| Field | Type | Odoo target | Notes |
|---|---|---|---|
| Company name **\*** | Text | `partner_name` | |
| Website | URL | `website` | Optional. |
| Industry | Dropdown | `industry_id` | Short curated list (TBD with sales lead). |
| Street | Text | `street` | Optional. |
| City | Text | `city` | Optional. |
| State | Dropdown (US states) | `state_id` | Optional. |
| ZIP | Text | `zip` | Optional. |

### Primary contact (maps to `res.partner` individual)
| Field | Type | Odoo target | Notes |
|---|---|---|---|
| Contact name **\*** | Text | `contact_name` | |
| Title / role | Text | `function` | |
| Email | Email | `email_from` | At least one of email/phone required. |
| Phone | Tel | `phone` | |
| Mobile | Tel | `mobile` | |

### Opportunity context
| Field | Type | Odoo target | Notes |
|---|---|---|---|
| Lead source | Dropdown | `source_id` | Referral / Cold visit / Inbound call / Existing relationship / Event / Other. |
| Referred by | Text | `referred` | Conditional — shown only if source = Referral. |
| Estimated annual value (USD) | Number | `expected_revenue` | Optional, rough. |
| Interest / product fit | Multi-select | `tag_ids` | Curated tag list (TBD). |
| Next-step date | Date | `date_deadline` | When rep plans to follow up. |
| Notes **\*** | Long text | `description` | Free-form — what was discussed, pain points, anything not captured above. |

**Required at minimum:** Rep, Company, Contact name, Notes, and at least one of Email/Phone.

## 7. UX requirements

- **Mobile-first.** Single-column layout, large tap targets (min 44px), native inputs (`type="tel"`, `type="email"`, `type="date"`) so phone keyboards behave correctly.
- **Section grouping** with collapsed/expanded accordions: *Rep*, *Company*, *Contact*, *Opportunity*, *Notes*. Reduces scroll fatigue.
- **Inline validation** — show errors next to the field on blur, not on submit.
- **Auto-save draft to `localStorage`** so a tab switch or accidental close doesn't lose data.
- **Submit feedback** — button shows spinner, then success state with "Log another" and "Done" options.
- **Visual polish** — Central Service & Supply brand colors (TBD — pull from centralsands.com), system font stack, generous whitespace. Clean and confident, not corporate-bloated.

## 8. Tech & architecture

Stopgap-grade. Aim for ~1 day of build, zero ongoing infra cost.

**Hosting:** **Netlify** (free tier). Connects to a GitHub repo, auto-deploys on push, free HTTPS, easy custom-domain hookup (e.g. `crm.centralsands.com`).

**Frontend:** Single-page app, deployed as static files.
- Recommended: **Next.js (static export) + Tailwind + shadcn/ui** → looks sharp out of the box, builds to static HTML/JS that Netlify serves directly.
- Alternative: plain HTML/Tailwind if we want zero build pipeline. Faster to ship, less polish ceiling.

**Form → Sheet pipeline:** **Google Apps Script Web App** bound to the destination Sheet.
- Form POSTs JSON straight to the Apps Script URL on submit.
- Script validates the payload and appends a row to the `Submissions` tab.
- No API keys, no service accounts, no third-party automation tools in the chain.
- The Sheet remains the source of truth and the eventual Odoo import file.

**Sheet structure:**
- Tab `Submissions` — one row per form submission, columns match Odoo field names exactly (e.g. `partner_name`, `contact_name`, `email_from`) so export is just "Download as CSV" → Odoo import.
- Tab `Reps` — list of active rep names that populates the Rep dropdown. **6 slots to start**, editable any time (add/rename/deactivate by editing the cell — change reflects in the form on next page load, no redeploy).
- Tab `Tags` / `Sources` / `Industries` — curated dropdown values, editable without code changes.

The Apps Script exposes a `GET` endpoint that returns the contents of `Reps`, `Sources`, `Industries`, and `Tags` as JSON so the frontend can stay in sync with the Sheet automatically.

**Spam / abuse:** Form is unlinked from the public site and shared only with reps. Acceptable risk for a stopgap. Add basic honeypot field if we want belt-and-suspenders.

## 9. Odoo migration path

When Odoo CRM is ready:
1. Export `Submissions` tab as CSV.
2. Map columns to `crm.lead` via Odoo's standard import wizard (column names already match).
3. Reps reassigned via `user_id` (mapped from the Rep dropdown to Odoo user accounts).
4. Sunset this form; redirect link to the Odoo lead-creation form.

No data migration scripts required if column naming stays disciplined.

## 10. Open questions

- [ ] Confirm the 6 starting rep names for the dropdown (easily editable in the Sheet later).
- [ ] Confirm Industry / Source / Tag option lists with the sales lead.
- [ ] Brand colors + logo asset from centralsands.com.
- [ ] Hosting domain — subdomain of centralsands.com (e.g. `crm.centralsands.com`) or stock Netlify `*.netlify.app` URL?
- [ ] Should the sales manager get an email notification on each submission, or just review the Sheet?

## 11. Milestones

| # | Deliverable | Est. |
|---|---|---|
| 1 | PRD signed off (this doc) | — |
| 2 | Field list + dropdown values finalized | 0.5 day |
| 3 | Apps Script + Sheet schema built | 0.5 day |
| 4 | Frontend built and deployed to staging URL | 1 day |
| 5 | Rep walkthrough + feedback | 0.5 day |
| 6 | Polish + go-live | 0.5 day |

**Target: usable by reps within ~1 week of sign-off.**
