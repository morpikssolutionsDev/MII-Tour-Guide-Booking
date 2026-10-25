// English copy for tourist-facing pages (overview §8.6). WhatsApp templates live in
// src/server/notify/templates.ts.
export const en = {
  feedback: {
    park: "Taman Mini Indonesia Indah",
    hi: (name: string) => `Hi ${name}!`,
    tourOn: "Your tour on",
    with: "with",
    overall: "How was your overall experience?",
    guide: (name: string) => `How was your guide, ${name}?`,
    ratingLabels: ["Poor", "Fair", "Good", "Very good", "Excellent"],
    comment: "Anything you'd like to share?",
    commentPlaceholder: "Tell us what you enjoyed or what we can improve (optional)",
    revisit: "Would you visit TMII again?",
    revisitAnswers: { yes: "Yes", maybe: "Maybe", no: "No" },
    consent: "TMII may contact me via WhatsApp or email about future visits and offers.",
    submit: "Send feedback",
    footer: "Your feedback is shared with TMII's tour guide team.",
    thanks: (name: string) => `Thank you, ${name}! 🙏`,
    thanksBody: "We hope to see you again at Taman Mini Indonesia Indah.",
    invalid: "This feedback link is not valid.",
    expired: "This feedback link has expired. Thank you for visiting TMII!",
    used: "You've already shared your feedback. Thank you!",
    locked: "Please try again later.",
    error: "Please rate your experience and each guide, and tell us if you would visit again.",
    required: "Required",
  },
};
