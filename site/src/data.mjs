// All site content and settings live here. Edit this file, then run `npm run build`.

export const site = {
  name: "Hammer Hound",
  legalName: "Dalton Enterprises LLC",
  tagline: "Real Jobs. Local Pros. Tracked Down.",
  url: "https://hammerhound.com",

  // false = every page is marked noindex and robots.txt blocks crawlers.
  // Set to true only when the placeholder reviews and prices below are replaced with real ones.
  launched: false,

  // Where forms post to. Empty = the form explains that Hammer Hound is not open yet
  // and nothing is sent. Fill these in when the lead engine is connected.
  endpoints: {
    request: "",
    contact: "",
    proJoin: "",
    proSignIn: "",
  },

  // Shown on the request form. Filled in when the confirmation-call number exists.
  confirmationCallNumber: "",
};

// PLACEHOLDER reviews. Not real customers. Labelled as samples on the page.
export const reviews = [
  { quote: "Two pros called within the hour and nobody else ever did.", who: "Sample Owner A", job: "Driveway" },
  { quote: "I picked one call and got one call. That was the whole point.", who: "Sample Owner B", job: "Roof repair" },
  { quote: "Had three quotes by dinner and hired the middle one.", who: "Sample Owner C", job: "Fence" },
];

export const tradeGroups = [
  {
    name: "Driveways, patios and paving",
    trades: [
      { slug: "concrete", name: "Concrete", blurb: "Driveways, patios, slabs", popular: true, jobs: ["Driveway", "Patio", "Slab or foundation", "Sidewalk", "Repair", "Other"] },
      { slug: "asphalt-paving", name: "Asphalt paving", short: "Paving", blurb: "Asphalt drives and lots", popular: true, jobs: ["Driveway", "Parking lot", "Private road", "Patching", "Resurfacing", "Other"] },
      { slug: "pavers", name: "Pavers", blurb: "Paver patios, walks and drives", jobs: ["Patio", "Walkway", "Driveway", "Pool deck", "Repair", "Other"] },
      { slug: "sealcoating", name: "Sealcoating", blurb: "Sealing and crack filling", jobs: ["Driveway", "Parking lot", "Crack filling", "Striping", "Other"] },
    ],
  },
  {
    name: "Roof and exterior",
    trades: [
      { slug: "roofing", name: "Roofing", blurb: "Repairs and replacements", popular: true, jobs: ["Leak or repair", "Full replacement", "New roof", "Storm damage", "Inspection", "Other"] },
      { slug: "siding", name: "Siding", blurb: "Vinyl, fiber cement, wood", jobs: ["Repair", "Full replacement", "New siding", "Trim and soffit", "Other"] },
      { slug: "gutters", name: "Gutters", blurb: "Install, repair and guards", jobs: ["New gutters", "Repair", "Gutter guards", "Cleaning", "Other"] },
      { slug: "windows-and-doors", name: "Windows and doors", blurb: "Replacement and install", jobs: ["Window replacement", "Door replacement", "Repair", "New opening", "Other"] },
    ],
  },
  {
    name: "Structure and site work",
    trades: [
      { slug: "masonry", name: "Masonry", blurb: "Brick, block, stone", popular: true, jobs: ["Brick or block wall", "Retaining wall", "Chimney", "Steps or walkway", "Repair or tuckpointing", "Other"] },
      { slug: "foundation-repair", name: "Foundation repair", blurb: "Cracks, settling, waterproofing", jobs: ["Cracks", "Settling or sinking", "Waterproofing", "Crawl space", "Inspection", "Other"] },
      { slug: "demolition", name: "Demolition", blurb: "Tear-outs and haul-away", popular: true, jobs: ["Whole structure", "Interior tear-out", "Concrete removal", "Shed or garage", "Haul-away", "Other"] },
      { slug: "excavation", name: "Excavation", blurb: "Grading, trenching, clearing", jobs: ["Grading", "Trenching", "Land clearing", "Drainage", "Other"] },
    ],
  },
  {
    name: "Yard and fencing",
    trades: [
      { slug: "fencing", name: "Fencing", blurb: "Wood, vinyl, chain link", popular: true, jobs: ["New wood fence", "New vinyl fence", "Chain link", "Gate", "Repair", "Other"] },
      { slug: "landscaping", name: "Landscaping", blurb: "Design, planting, hardscape", jobs: ["New design", "Planting", "Sod or seed", "Drainage", "Other"] },
      { slug: "tree-service", name: "Tree service", blurb: "Removal, trimming, stumps", jobs: ["Tree removal", "Trimming", "Stump grinding", "Storm cleanup", "Other"] },
      { slug: "decks", name: "Decks", blurb: "New decks and repairs", jobs: ["New deck", "Repair", "Resurface", "Stairs or railing", "Other"] },
    ],
  },
  {
    name: "Home systems",
    trades: [
      { slug: "plumbing", name: "Plumbing", blurb: "Leaks, heaters, repipes", popular: true, jobs: ["Leak or repair", "Water heater", "Drain or sewer", "Repipe", "Fixture install", "Other"] },
      { slug: "electrical", name: "Electrical", blurb: "Panels, wiring, lighting", popular: true, jobs: ["Panel upgrade", "Wiring", "Lighting", "Outlets and switches", "EV charger", "Other"] },
      { slug: "heating-and-cooling", name: "Heating and cooling", blurb: "Repair and replacement", jobs: ["Repair", "New system", "Ductwork", "Tune-up", "Other"] },
      { slug: "water-heaters", name: "Water heaters", blurb: "Tank and tankless", jobs: ["Replace tank heater", "Tankless install", "Repair", "Other"] },
    ],
  },
  {
    name: "Inside the home",
    trades: [
      { slug: "flooring", name: "Flooring", blurb: "Hardwood, tile, carpet, vinyl", jobs: ["Hardwood", "Tile", "Carpet", "Vinyl or laminate", "Refinishing", "Other"] },
      { slug: "painting", name: "Painting", blurb: "Interior and exterior", jobs: ["Interior", "Exterior", "Cabinets", "Deck or fence stain", "Other"] },
      { slug: "drywall", name: "Drywall", blurb: "Hanging, finishing, repair", jobs: ["Repair", "New drywall", "Texture", "Ceiling", "Other"] },
      { slug: "remodeling", name: "Remodeling", blurb: "Kitchens, baths, additions", jobs: ["Kitchen", "Bathroom", "Basement", "Addition", "Whole home", "Other"] },
    ],
  },
];

export const trades = tradeGroups.flatMap((g) => g.trades.map((t) => ({ ...t, group: g.name })));
// Order of the eight "popular jobs" tiles, as designed.
export const popularOrder = ["concrete", "roofing", "asphalt-paving", "fencing", "plumbing", "electrical", "masonry", "demolition"];
export const popular = popularOrder.map((s) => trades.find((t) => t.slug === s));

export const faqs = [
  { q: "Is it really free for property owners?", a: "Yes. Pros pay for the introduction. You never pay to post a request or to talk to a pro." },
  { q: "How many pros will contact me?", a: "Only as many as you choose, from 1 to 5. That number is a cap, so you may hear from fewer if fewer pros near you take the request." },
  { q: "Who sees my phone number?", a: "We do, and the pros who take your request. Nobody else. We call you first with an AI assistant to confirm the details, and that call is recorded." },
  { q: "What kinds of jobs can I request?", a: "Any trade and any size, for a home, a rental or a business. If your job is not listed, choose Something else and describe it." },
  { q: "What if I change my mind?", a: "Tap Stop more calls on your status page and no more pros will get your request. A pro who already has it may still call once." },
];

// PLACEHOLDER cost guides. Every price below is a stand-in, not real cost data.
// Real guides are AI-written and published every Monday; each new guide is one more entry here.
export const guides = [
  {
    slug: "concrete-driveway-cost",
    title: "What a concrete driveway costs in 2026",
    short: "Concrete driveway cost",
    trade: "concrete", category: "Concrete", crumb: "Driveways",
    date: "2026-11-16", minutes: 7, image: "guide-concrete-driveway.jpg",
    typical: "$4,200 to $9,800",
    summary: "Size, tear-out, thickness and finish decide where your driveway lands in that range.",
    stats: [["Typical total", "$4,200 to $9,800"], ["Per square foot", "$8 to $18"], ["Typical size", "600 sq ft"]],
    intro: "A plain concrete driveway for a two-car home usually lands in the range above. The final number depends mostly on size, how much old material has to come out, and the finish you choose.",
    tableTitle: "Cost by driveway size",
    tableHead: ["Size", "Square feet", "Typical cost"],
    tableRows: [["One car", "300", "$2,400 to $5,400"], ["Two car", "600", "$4,800 to $10,800"], ["Three car", "900", "$7,200 to $16,200"]],
    factors: [["Tear-out", "Removing an old driveway adds labor and haul-away."], ["Thickness and base", "Heavier vehicles need a thicker slab and more gravel underneath."], ["Finish", "Broom finish costs least. Stamped or colored concrete costs more."], ["Access and slope", "Tight or steep sites take longer to form and pour."]],
    cta: "Get real quotes for your driveway", pros: "concrete pros",
  },
  {
    slug: "roof-replacement-cost",
    title: "Roof replacement cost: shingles, labor and tear-off",
    short: "Roof replacement cost",
    trade: "roofing", category: "Roofing", crumb: "Replacement",
    date: "2026-11-09", minutes: 8, image: "guide-roof-replacement.jpg",
    typical: "$8,500 to $16,000",
    summary: "Roof size, pitch, the shingle you pick and how many old layers come off set the price.",
    stats: [["Typical total", "$8,500 to $16,000"], ["Per square (100 sq ft)", "$450 to $800"], ["Typical size", "20 squares"]],
    intro: "Replacing an asphalt shingle roof on an average home usually lands in the range above. Steeper roofs, more layers to tear off and upgraded shingles push the number up.",
    tableTitle: "Cost by roof size",
    tableHead: ["Home size", "Roof squares", "Typical cost"],
    tableRows: [["Small", "15", "$6,800 to $12,000"], ["Average", "20", "$9,000 to $16,000"], ["Large", "30", "$13,500 to $24,000"]],
    factors: [["Tear-off", "Each old layer that comes off adds labor and disposal."], ["Pitch and height", "Steep or tall roofs need more safety gear and time."], ["Shingle grade", "Architectural shingles cost more than three-tab and last longer."], ["Decking repairs", "Rotten plywood found under the shingles is replaced by the sheet."]],
    cta: "Get real quotes for your roof", pros: "roofing pros",
  },
  {
    slug: "asphalt-paving-cost-per-square-foot",
    title: "Asphalt paving cost per square foot",
    short: "Asphalt paving cost per square foot",
    trade: "asphalt-paving", category: "Paving", crumb: "Asphalt",
    date: "2026-11-02", minutes: 6, image: "guide-asphalt-paving.jpg",
    typical: "$3 to $7 per sq ft",
    summary: "Area, base work and whether old pavement is removed or overlaid drive the per-foot price.",
    stats: [["Typical price", "$3 to $7 per sq ft"], ["Two-car driveway", "$1,800 to $4,200"], ["Typical thickness", "2 to 3 inches"]],
    intro: "New asphalt for a driveway or small lot usually prices by the square foot in the range above. Bigger jobs cost less per foot, and a poor base costs more to fix than the asphalt itself.",
    tableTitle: "Cost by area",
    tableHead: ["Job", "Square feet", "Typical cost"],
    tableRows: [["Two-car driveway", "600", "$1,800 to $4,200"], ["Long driveway", "1,500", "$4,500 to $10,500"], ["12-space lot", "4,000", "$12,000 to $28,000"]],
    factors: [["Base and grading", "Soft or poorly drained ground needs new gravel before paving."], ["Overlay or full depth", "Paving over sound asphalt costs less than removing it."], ["Thickness", "Trucks and heavy traffic need a thicker mat."], ["Size of the job", "Small jobs carry a higher per-foot price to cover equipment."]],
    cta: "Get real quotes for your paving job", pros: "paving pros",
  },
  {
    slug: "wood-privacy-fence-cost-per-foot",
    title: "Wood privacy fence cost per foot",
    short: "Wood privacy fence cost per foot",
    trade: "fencing", category: "Fencing", crumb: "Wood fences",
    date: "2026-10-26", minutes: 5, image: "guide-wood-fence.jpg",
    typical: "$20 to $45 per foot",
    summary: "Length, height, the wood you choose and the number of gates decide the total.",
    stats: [["Typical price", "$20 to $45 per foot"], ["150-foot yard", "$3,000 to $6,750"], ["Typical height", "6 feet"]],
    intro: "A six-foot wood privacy fence usually prices by the linear foot in the range above. Cedar costs more than pressure-treated pine, and every gate adds to the total.",
    tableTitle: "Cost by fence length",
    tableHead: ["Yard", "Linear feet", "Typical cost"],
    tableRows: [["Small yard", "100", "$2,000 to $4,500"], ["Average yard", "150", "$3,000 to $6,750"], ["Large yard", "250", "$5,000 to $11,250"]],
    factors: [["Wood type", "Cedar and redwood cost more than treated pine."], ["Height", "An eight-foot fence uses more lumber and longer posts."], ["Gates", "Each gate adds hardware, framing and labor."], ["Old fence removal", "Tearing out and hauling away an old fence is extra."]],
    cta: "Get real quotes for your fence", pros: "fencing pros",
  },
  {
    slug: "water-heater-replacement-cost",
    title: "Water heater replacement cost",
    short: "Water heater replacement cost",
    trade: "plumbing", category: "Plumbing", crumb: "Water heaters",
    date: "2026-10-19", minutes: 5, image: "guide-water-heater.jpg",
    typical: "$1,200 to $2,800",
    summary: "Tank size, gas or electric, and any code upgrades set the installed price.",
    stats: [["Typical total", "$1,200 to $2,800"], ["Tankless", "$2,500 to $5,000"], ["Typical tank", "40 to 50 gallons"]],
    intro: "Swapping a standard tank water heater for the same type usually lands in the range above. Switching fuel, moving the unit or going tankless costs more.",
    tableTitle: "Cost by heater type",
    tableHead: ["Type", "Size", "Typical cost"],
    tableRows: [["Electric tank", "40 to 50 gal", "$1,200 to $2,200"], ["Gas tank", "40 to 50 gal", "$1,500 to $2,800"], ["Tankless", "Whole home", "$2,500 to $5,000"]],
    factors: [["Fuel type", "Gas units need venting and a gas line that electric units do not."], ["Code upgrades", "Expansion tanks, pans and new valves may be required."], ["Location", "Attics, closets and crawl spaces take longer to work in."], ["Haul-away", "Removing and disposing of the old tank may be a separate line."]],
    cta: "Get real quotes for your water heater", pros: "plumbing pros",
  },
  {
    slug: "200-amp-panel-upgrade-cost",
    title: "200-amp panel upgrade cost",
    short: "200-amp panel upgrade cost",
    trade: "electrical", category: "Electrical", crumb: "Panels",
    date: "2026-10-12", minutes: 6, image: "guide-panel-upgrade.jpg",
    typical: "$1,800 to $4,000",
    summary: "The service coming into the house, the meter and any rewiring decide the price.",
    stats: [["Typical total", "$1,800 to $4,000"], ["With new service line", "$3,000 to $6,000"], ["Typical time", "1 day"]],
    intro: "Upgrading a home from 100 to 200 amps usually lands in the range above. If the utility line, meter base or grounding also has to be replaced, expect the higher figures.",
    tableTitle: "Cost by scope",
    tableHead: ["Scope", "Includes", "Typical cost"],
    tableRows: [["Panel swap", "New 200-amp panel and breakers", "$1,800 to $3,000"], ["Panel and meter", "Adds meter base and mast", "$2,500 to $4,000"], ["Full service upgrade", "Adds new service line", "$3,000 to $6,000"]],
    factors: [["Service line", "An undersized utility line has to be replaced to carry 200 amps."], ["Permits and inspection", "Most areas require a permit and a utility disconnect."], ["Panel location", "Moving the panel means extending every circuit."], ["Old wiring", "Aluminum or damaged wiring found during the job adds work."]],
    cta: "Get real quotes for your panel upgrade", pros: "electrical pros",
  },
];

export const nextGuide = { date: "2026-11-23", title: "Brick and block repair cost" };
export const guideCategories = ["Concrete", "Roofing", "Paving", "Fencing", "Plumbing", "Electrical", "Masonry", "Demolition"];
