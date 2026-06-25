# AXG Sales Assistant — Verification & Completion Checklist

This is the single to-do list that turns the pilot artifacts from "draft" to "trustworthy." It collects every flagged item across all four files so nothing gets lost.

There are two distinct kinds of work here, and they need different people:
- **VERIFY** — data we already have but transcribed from a scrambled source; confirm against the datasheet. (Engineer + datasheet.)
- **DECIDE / CAPTURE** — judgments only Allied can make, or knowledge still to gather. (Sales/engineering judgment.)

**Important:** verify against the **clean datasheet pages (images/PDF)**, not the scrambled `.txt`. The column-scramble in the text extraction is the root cause of most flags below; clean pages avoid it entirely.

---

## A. Data Verification — against the source datasheet
*Owner: engineer with the datasheet. Priority-ordered.*

- [x] **A1 — Process-connection size matrix (HIGHEST). ✅ DONE (2026-06-10).** File: `axg_model_code.json`, position 5. All 39 connection codes verified against clean datasheet pages (pp. 39–41).
  - **5 corrections found and fixed:** the scrambled extraction had `BA2`, `BE1`, `BE2`, `BE3`, `BE4` size ranges shifted across rows. Now corrected (e.g. BE3 was "2.5 to 50 mm", actually "80 to 400 mm").
  - All exclusions captured (AP1/BP1/PA1/PA2/PJ1: 32-65-125 mm excluded; PE2: 125 mm excluded; PE4: 32 mm excluded; CS1/CS2: 65-125 mm excluded).
- [x] **A2 — Flanged lay lengths. ✅ DONE (2026-06-10).** File: `axg_dimensions_retrofit.json`, `yokogawa_dimensions.flanged_150`. Full flanged table verified against datasheet pp. 81–82 — matched the prior Allied data exactly on every size. **Bonus captured:** grounding-ring lay-length additions (thin-type negligible; electrode-type adds 1.1–1.6 in and must be factored into retrofit fitment).
- [x] **A3 — 20" Yokogawa flanged value. ✅ DONE (2026-06-10).** Allied-confirmed at **23.62 in (= 600 mm exactly)**. The flat step from the 16" value is real, not a transcription error.
- [ ] **A4 — GRL with explosion protection (HIGH).** Files: `axg_model_code.json` (allied_defaults → Optional Specification) and the grounding-ring applicability grid. The datasheet footnote says some grounding-ring types aren't applicable with explosion protection, and the applicability grid didn't survive text extraction. Your default `/GRL` rides on every XP build, so this must be confirmed. *Done when:* GRL-with-`-C` confirmed permitted, or the default is adjusted for XP builds.
- [x] **A5 — Explosion-protection limitations. ✅ DONE (2026-06-10).** Full "Restriction for Explosion protection type" table captured (datasheet pp. 53–55) into `explosion_protection_restrictions` — mandatory + not-available combinations for all 22 explosion codes, with FF2 (Allied default) detailed. **Cross-validation:** FF2 *mandates* Cable Entry 2 (NPT), confirming Allied's independently-set default.
- [x] **A6 — Accuracy "High Grade" (C) size restriction. ✅ DONE (2026-06-10).** Confirmed: code C (High Grade) is restricted to **25 to 200 mm (1 to 8 in.)**. Verified against clean datasheet p. 41.
- [x] **A7 — Use vs Explosion-Protection pairing. ✅ DONE (2026-06-10).** Confirmed: every non-000 explosion code forces Use = -C (excludes -G/-W/-H); IS-output variants also exclude remote-sensor construction and require wiring terminal 2. Captured in `cross_position_rules.use_vs_explosion` and `explosion_protection_restrictions.universal_rules`.

---

## B. Competitor Data Verification — retrofit advisor
*Owner: whoever maintains competitive data. File: `axg_dimensions_retrofit.json`.*

- [ ] **B1 — Date-stamp competitor lay lengths.** Set `competitor_crossref.verified_as_of`. Competitor specs drift between product generations; without a stamp, fitment promises silently go stale. *Done when:* a verification date is set and the figures spot-checked against current competitor literature.
- [ ] **B2 — Resolve Foxboro generations.** The "Old" vs "9700/New" columns differ materially (e.g. 1" wafer: 2.81 vs 2.13). Confirm both sets and document how the agent should ask which generation the customer has. *Done when:* both generations confirmed and the ask is built into the question flow.
- [ ] **B3 — Fill competitor wafer gaps.** Rosemount and Endress wafer columns are empty — confirm whether they offer wafer at all, or just collect the data. *Done when:* gaps are either filled or explicitly marked "not offered."

---

## C. Business-Judgment Decisions — Allied to set
*Owner: Allied sales/engineering. These are choices, not lookups.*

- [x] **C1 — Fit-verdict tolerances. ✅ DONE (2026-06-10).** Drop-in tolerance confirmed by Allied at **1/4 in (0.25")**. Within ¼" of the competitor lay length = clean drop-in; beyond it, the longer/shorter logic applies (spool work vs spacer).
- [x] **C2 — Low-conductivity warning band. ✅ DONE (2026-06-10).** Set to **10 µS/cm**: fluids below 10 µS/cm (but above their size minimum) get a low-conductivity caution flag rather than auto-proceeding. (Edge case noted: the 500 mm floor of 20 µS/cm already exceeds 10, so the band applies to all sizes except 500 mm.)
- [x] **C3 — Confirm the assumed defaults. ✅ DONE (2026-06-10).** All three confirmed as Allied standard: Cable Entry `2` (ASME 1/2 NPT), Power Supply `-1` (100–240 VAC), Accuracy `B` (Standard).

---

## D. Source-of-Truth Setup
*Owner: engineering. The compatibility gate depends on this.*

- [ ] **D1 — Chemical-resistance reference.** File: `axg_application_rules.json`, `mandatory_compatibility_gate.source_of_truth`. The compatibility gate must resolve against a verified resistance reference (manufacturer data, a vetted chart, or Allied's own table) — never the model's memory. Identify and connect that reference. *Done when:* a named, authoritative compatibility source is in place and the gate points to it.

---

## E. Tribal Knowledge Still to Capture
*Owner: senior salesperson + Claude to structure. Ordered by value.*

- [x] **E1 — Chemical-to-material mappings (HIGHEST VALUE).** File: `axg_application_rules.json`, bucket 4 `entries`. The specific "for fluid X at temp Y, use electrode/lining Z" rules that turn the compatibility gate from a process into concrete answers. This is pure Allied expertise, in no datasheet. *Done when:* the common-fluid mappings are captured as gate-resolvable entries.
  - **PROGRESS (2026-06-10):** datasheet-derived material guidance now captured — permeable-fluid mitigation via Vent Hole (`/H`), acid/alkali gasket selection (`/GC`, `/GD`), and grounding-ring-matches-electrode logic. **Still needed from Allied:** the *fluid-specific* electrode/lining upgrade thresholds (e.g. "sulfuric above X% → tantalum") that only your expertise/resistance chart holds.
- [ ] **E2 — Never-order list (bucket 3).** Legal-but-unwise combinations, non-stocked options, long-lead items. Feeds the "allowed-with-warning" deviation logic. *Done when:* the known bad-idea combinations are captured.
- [ ] **E3 — Remaining always-ask questions (bucket 1).** Still pending: is-the-pipe-full, hazardous-area classification, line pressure, slurry/abrasive content. *Done when:* each is captured with the rules it drives.
- [ ] **E4 — Remaining red flags (bucket 5).** Still pending: empty/partially-full pipe, coating/fouling fluids, extreme process temperature. *Done when:* each is captured with its escalation action.

---

## Suggested order of attack

1. **A1 + A4 first** — highest-risk data, and both touch your standard XP build directly.
2. **D1 + E1 together** — stand up the compatibility source, then capture the mappings that use it. Highest safety value.
3. **A2/A3 + B1/B2** — clear the dimensions and retrofit data so the advisor is quote-ready.
4. **C1–C3** — quick judgment calls, knock them out in one sitting.
5. **E2–E4** — the remaining tribal capture, ongoing.

Everything in section A and B is a finite, bounded task against a document. Sections C–E are where Allied's expertise gets encoded — and that's the part that makes this yours rather than generic.
