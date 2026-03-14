export const legalArenaScenarios = [
  {
    id: "security-deposit",
    title: "Security Deposit Showdown",
    subtitle: "A landlord kept most of a deposit after move-out.",
    practiceArea: "Housing",
    courtName: "Civic Claims Court",
    clientName: "Maya Chen",
    opponentName: "Harbor Point Rentals",
    overview:
      "Your client wants back a $1,200 security deposit after the landlord deducted charges for cleaning and wall repairs.",
    desiredRelief: "Return of the withheld $1,200 deposit plus filing costs.",
    openingStatement:
      "I moved out six weeks ago, cleaned the apartment, and then my landlord sent a vague message saying I only deserved $180 of my deposit back.",
    starterTheory:
      "The landlord withheld deposit money without reliable proof and treated ordinary wear as damage.",
    legalTags: ["housing", "notice", "records", "damage", "remedy"],
    opponentClaims: [
      "The apartment required unusual cleaning.",
      "There were wall marks and nail holes beyond normal wear.",
      "The deductions were commercially reasonable.",
    ],
    factInventory: [
      {
        id: "sd-walkthrough",
        label: "Move-in inspection was clean",
        detail:
          "The move-in checklist marked the walls and floors as being in good condition with no listed damage.",
        keywords: ["move-in", "inspection", "checklist", "condition"],
        category: "supporting",
      },
      {
        id: "sd-photos",
        label: "Move-out photos exist",
        detail:
          "Maya took timestamped photos on move-out day showing swept floors, wiped counters, and only a few faint wall scuffs.",
        keywords: ["photos", "picture", "move-out", "timestamp", "clean"],
        category: "supporting",
      },
      {
        id: "sd-no-itemization",
        label: "Itemization came late",
        detail:
          "The landlord did not send a detailed itemized list until after Maya repeatedly asked for one, and the first message only said 'repairs and cleaning.'",
        keywords: ["itemized", "itemization", "late", "message", "notice"],
        category: "timeline",
      },
      {
        id: "sd-painting",
        label: "Apartment had been occupied for years",
        detail:
          "The apartment had not been repainted for nearly four years before Maya moved out.",
        keywords: ["paint", "years", "repainted", "wear"],
        category: "supporting",
      },
      {
        id: "sd-dog",
        label: "Client had a visiting dog once",
        detail:
          "Maya's sister brought a dog over for one weekend, which the landlord may try to frame as the source of odor or mess.",
        keywords: ["dog", "odor", "pet", "weekend"],
        category: "risk",
      },
      {
        id: "sd-receipt",
        label: "Repair invoice looks generic",
        detail:
          "The invoice the landlord eventually shared is a one-line bill for 'turnover services' and does not mention Maya's unit specifically.",
        keywords: ["invoice", "receipt", "generic", "bill", "turnover"],
        category: "supporting",
      },
    ],
  },
  {
    id: "freelance-invoice",
    title: "The Vanishing Invoice",
    subtitle: "A client used the work but refuses to pay the final bill.",
    practiceArea: "Services",
    courtName: "Downtown Contract Bench",
    clientName: "Elliot Rivera",
    opponentName: "Northstar Fitness Studio",
    overview:
      "Your client delivered a branding package for a fitness studio and is owed $4,500 on the final invoice.",
    desiredRelief: "Payment of the $4,500 final invoice and filing costs.",
    openingStatement:
      "I finished the logo package, brand guide, and social templates, but once they started using the work they stopped responding about the final payment.",
    starterTheory:
      "The client accepted and used the deliverables, so withholding the final invoice is unreasonable.",
    legalTags: ["services", "records", "reasonableness", "remedy"],
    opponentClaims: [
      "The work was incomplete or needed revisions.",
      "The studio believed the final payment depended on a formal launch.",
      "Any delays were caused by Elliot's responsiveness.",
    ],
    factInventory: [
      {
        id: "fi-contract",
        label: "Written scope and payment schedule",
        detail:
          "The signed proposal states that the last 50 percent is due within seven days of final file delivery.",
        keywords: ["contract", "proposal", "payment", "schedule", "due"],
        category: "supporting",
      },
      {
        id: "fi-delivery",
        label: "Files were delivered",
        detail:
          "Elliot sent a download link to the studio with the full brand package and source files.",
        keywords: ["delivered", "files", "download", "source", "package"],
        category: "timeline",
      },
      {
        id: "fi-usage",
        label: "Studio used the assets publicly",
        detail:
          "Northstar posted the new logo and colors on Instagram and printed a banner using the final design set.",
        keywords: ["used", "instagram", "banner", "logo", "publicly"],
        category: "supporting",
      },
      {
        id: "fi-revisions",
        label: "There were revision requests",
        detail:
          "The studio asked for extra revisions after approval, and Elliot completed two rounds anyway to keep the relationship smooth.",
        keywords: ["revision", "changes", "approval", "extra"],
        category: "risk",
      },
      {
        id: "fi-reminder",
        label: "Multiple reminders were sent",
        detail:
          "Elliot sent three payment reminders over two weeks before threatening legal action.",
        keywords: ["reminder", "email", "weeks", "notice"],
        category: "timeline",
      },
      {
        id: "fi-feedback",
        label: "Client praised the work",
        detail:
          "The studio owner replied 'This looks amazing, we're excited to launch it' the day the files were delivered.",
        keywords: ["praise", "amazing", "launch", "excited"],
        category: "supporting",
      },
    ],
  },
  {
    id: "wrongful-tow",
    title: "Midnight Tow Trouble",
    subtitle: "A vehicle was towed from a permitted residential lot.",
    practiceArea: "Property",
    courtName: "Neighborhood Claims Court",
    clientName: "Jordan Bell",
    opponentName: "Metro Tow and Storage",
    overview:
      "Your client's car was towed from an apartment lot even though Jordan says a valid parking permit was displayed.",
    desiredRelief:
      "Reimbursement of tow and storage fees totaling $360, plus filing costs.",
    openingStatement:
      "I parked in my assigned building lot with the permit on my dashboard, and by morning the car was gone and the tow company wanted cash to release it.",
    starterTheory:
      "The tow was improper because Jordan had authorization to park and the towing company acted without adequate verification.",
    legalTags: ["notice", "records", "fairness", "remedy"],
    opponentClaims: [
      "The permit was not visible from outside the car.",
      "The lot rules permit towing vehicles without clearly displayed authorization.",
      "The company followed the property manager's request.",
    ],
    factInventory: [
      {
        id: "wt-permit",
        label: "Permit was current",
        detail:
          "Jordan's permit was current for the month of the tow and matched the apartment unit on file.",
        keywords: ["permit", "current", "unit", "dashboard"],
        category: "supporting",
      },
      {
        id: "wt-photo",
        label: "Photo before towing exists",
        detail:
          "Jordan took a photo the evening before showing the permit on the dashboard because the apartment complex had recently warned about towing.",
        keywords: ["photo", "dashboard", "warning", "evening"],
        category: "supporting",
      },
      {
        id: "wt-cash",
        label: "Release required cash",
        detail:
          "Metro Tow only accepted cash for release until Jordan argued at the lot and eventually paid with a debit card.",
        keywords: ["cash", "release", "debit", "storage"],
        category: "risk",
      },
      {
        id: "wt-calllog",
        label: "Property manager blamed tow company",
        detail:
          "The property manager later said the tow company was supposed to verify permit numbers against the resident list before removing cars.",
        keywords: ["manager", "verify", "resident", "list", "call"],
        category: "supporting",
      },
      {
        id: "wt-signage",
        label: "Signage was cluttered",
        detail:
          "The lot signs listed towing enforcement but the contact number was partially faded and hard to read at night.",
        keywords: ["sign", "signage", "night", "faded"],
        category: "timeline",
      },
      {
        id: "wt-delay",
        label: "Client discovered tow late",
        detail:
          "Jordan did not notice the tow until early morning because the car was parked overnight and Jordan was asleep.",
        keywords: ["late", "morning", "overnight", "notice"],
        category: "timeline",
      },
    ],
  },
];

export const getScenarioById = (scenarioId) =>
  legalArenaScenarios.find((scenario) => scenario.id === scenarioId);

export const getScenarioCards = () =>
  legalArenaScenarios.map((scenario) => ({
    id: scenario.id,
    title: scenario.title,
    subtitle: scenario.subtitle,
    practiceArea: scenario.practiceArea,
    overview: scenario.overview,
    courtName: scenario.courtName,
    clientName: scenario.clientName,
    opponentName: scenario.opponentName,
  }));
