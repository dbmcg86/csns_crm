// Placeholder option lists. Once Apps Script is wired up, these can be
// fetched live from the Reps / Industries / Sources / Tags tabs of the Sheet.

export const REPS = [
  "Rep 1",
  "Rep 2",
  "Rep 3",
  "Rep 4",
  "Rep 5",
  "Rep 6",
];

export const INTERACTION_TYPES = [
  { value: "visit", label: "In-person visit" },
  { value: "phone", label: "Phone call" },
  { value: "email", label: "Email" },
  { value: "event", label: "Trade show / event" },
  { value: "other", label: "Other" },
];

export const INDUSTRIES = [
  "Aggregate / Quarry",
  "Mining",
  "Construction",
  "Concrete / Asphalt / Ready-mix",
  "Wastewater / Municipal",
  "Power generation",
  "Industrial / Manufacturing",
  "Oil & Gas",
  "Government / DOT",
  "Equipment rental fleet",
  "Other",
];

export const SOURCES = [
  { value: "referral", label: "Referral" },
  { value: "manufacturer_referral", label: "Manufacturer referral (Metso, Godwin, Flygt, etc.)" },
  { value: "cold_visit", label: "Cold visit" },
  { value: "inbound_call", label: "Inbound call" },
  { value: "existing_relationship", label: "Existing relationship" },
  { value: "event", label: "Trade show / event" },
  { value: "other", label: "Other" },
];

// Product-line interest tags. Matches what Central Service & Supply sells:
// crushing/screening equipment, conveyors, pumps, rigging, wear parts, plus
// the two distinct service motions (rental and parts/service).
export const TAGS = [
  "Crushers",
  "Screens & screening media",
  "Conveyors",
  "Dewatering pumps",
  "Wastewater / municipal pumps",
  "Slurry pumps",
  "Rigging & hoists",
  "Chain & slings",
  "Wear parts & idlers",
  "Belt scales / automation",
  "Custom fabrication",
  "Rental",
  "Parts / service / repair",
];

export const US_STATES = [
  ["AL", "Alabama"],
  ["AK", "Alaska"],
  ["AZ", "Arizona"],
  ["AR", "Arkansas"],
  ["CA", "California"],
  ["CO", "Colorado"],
  ["CT", "Connecticut"],
  ["DE", "Delaware"],
  ["FL", "Florida"],
  ["GA", "Georgia"],
  ["HI", "Hawaii"],
  ["ID", "Idaho"],
  ["IL", "Illinois"],
  ["IN", "Indiana"],
  ["IA", "Iowa"],
  ["KS", "Kansas"],
  ["KY", "Kentucky"],
  ["LA", "Louisiana"],
  ["ME", "Maine"],
  ["MD", "Maryland"],
  ["MA", "Massachusetts"],
  ["MI", "Michigan"],
  ["MN", "Minnesota"],
  ["MS", "Mississippi"],
  ["MO", "Missouri"],
  ["MT", "Montana"],
  ["NE", "Nebraska"],
  ["NV", "Nevada"],
  ["NH", "New Hampshire"],
  ["NJ", "New Jersey"],
  ["NM", "New Mexico"],
  ["NY", "New York"],
  ["NC", "North Carolina"],
  ["ND", "North Dakota"],
  ["OH", "Ohio"],
  ["OK", "Oklahoma"],
  ["OR", "Oregon"],
  ["PA", "Pennsylvania"],
  ["RI", "Rhode Island"],
  ["SC", "South Carolina"],
  ["SD", "South Dakota"],
  ["TN", "Tennessee"],
  ["TX", "Texas"],
  ["UT", "Utah"],
  ["VT", "Vermont"],
  ["VA", "Virginia"],
  ["WA", "Washington"],
  ["WV", "West Virginia"],
  ["WI", "Wisconsin"],
  ["WY", "Wyoming"],
] as const;
