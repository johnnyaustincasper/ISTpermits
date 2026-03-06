// Real permit data parsed from November 2025 NOW Reports
// Custom/indie builders — your IST lead targets
// Production builders shown separately for market awareness

export const PRODUCTION_BUILDERS = [
  "SIMMONS HOMES", "D R HORTON", "DR HORTON", "CAPITAL HOMES",
  "EXECUTIVE HOMES", "RAUSCH-COLEMAN", "RAUSCH COLEMAN",
  "IDEAL HOMES", "HOMES BY TABER"
];

export function isProduction(builder) {
  const b = builder.toUpperCase();
  return PRODUCTION_BUILDERS.some(p => b.includes(p));
}

export const PERMITS = [
  // ═══ CUSTOM / INDIE BUILDERS ═══
  { id: 1, builder: "True North Homes", address: "5824 N Eagle Rd", city: "Owasso", sqft: 10667, value: 1400000, lat: 36.285, lng: -95.813, week: "11/16-11/22", phone: "(918)845-1682", subdivision: "Bluffs @ Stone Canyon", contact: "Grant Hinkle", production: false },
  { id: 2, builder: "Dwell Homes", address: "23215 E 131 St", city: "Broken Arrow", sqft: 5250, value: 1300000, lat: 35.965, lng: -95.715, week: "11/9-11/15", phone: "(918)704-2102", subdivision: "", contact: "", production: false },
  { id: 3, builder: "True North Homes", address: "2457 E 26 Pl", city: "Tulsa", sqft: 2419, value: 1150000, lat: 36.15, lng: -95.935, week: "11/23-11/29", phone: "(918)845-1682", subdivision: "Woody Crest", contact: "Grant Hinkle", production: false },
  { id: 4, builder: "Abbey Homes", address: "5907 N Eagle Rd", city: "Owasso", sqft: 7638, value: 900000, lat: 36.284, lng: -95.814, week: "11/16-11/22", phone: "(918)640-7252", subdivision: "Bluffs @ Stone Canyon", contact: "Thomas/Connell Curran", production: false },
  { id: 5, builder: "True North Homes", address: "4609 S Birmingham Av", city: "Tulsa", sqft: 6401, value: 900000, lat: 36.123, lng: -95.948, week: "11/16-11/22", phone: "(918)845-1682", subdivision: "", contact: "Grant Hinkle", production: false },
  { id: 6, builder: "Brad Dunlap", address: "11312 S Harvard Av", city: "Tulsa", sqft: 5937, value: 900000, lat: 35.994, lng: -95.955, week: "11/16-11/22", phone: "(918)282-3898", subdivision: "Waterstone Estates", contact: "", production: false },
  { id: 7, builder: "Gregory Homes", address: "580 Creekside Dr", city: "Sapulpa", sqft: 0, value: 850000, lat: 36.005, lng: -96.115, week: "11/2-11/8", phone: "(918)927-1912", subdivision: "", contact: "", production: false },
  { id: 8, builder: "Spencer Construction", address: "3630 S Yorktown Av", city: "Tulsa", sqft: 7152, value: 825000, lat: 36.12, lng: -95.97, week: "11/16-11/22", phone: "(918)260-7329", subdivision: "Highland Park Estates", contact: "Ron/Ryan Spencer", production: false },
  { id: 9, builder: "Homes by TWD", address: "4539 S Lewis Av", city: "Tulsa", sqft: 5783, value: 770000, lat: 36.115, lng: -95.956, week: "11/2-11/8", phone: "(918)607-2434", subdivision: "Barrows Orchard Acres", contact: "Donald Burns", production: false },
  { id: 10, builder: "Cozort Custom Homes", address: "620 W 87 St", city: "Tulsa", sqft: 6563, value: 750000, lat: 36.043, lng: -96.005, week: "11/9-11/15", phone: "(918)899-4346", subdivision: "Estates @ Tulsa Hills", contact: "Matt Cozort", production: false },
  { id: 11, builder: "M C 2 Homes", address: "7600 S Sixth St", city: "Broken Arrow", sqft: 3880, value: 732000, lat: 36.038, lng: -95.805, week: "11/16-11/22", phone: "(918)973-2480", subdivision: "Lakes @ Indian Springs", contact: "Josh Ford/Lance McLearen", production: false },
  { id: 12, builder: "Bomanite of Tulsa", address: "2323 S Delaware Pl", city: "Tulsa", sqft: 6115, value: 650000, lat: 36.138, lng: -95.963, week: "11/2-11/8", phone: "(918)744-6272", subdivision: "Bryn Mawr", contact: "Charles Foster", production: false },
  { id: 13, builder: "Brandon Reeves", address: "8947 E Timber Wolf Dr", city: "Wagoner", sqft: 2915, value: 635000, lat: 35.98, lng: -95.67, week: "11/23-11/29", phone: "(918)798-4581", subdivision: "Wolf Creek Estates", contact: "", production: false },
  { id: 14, builder: "Highfill Properties", address: "1600 North Haven Dr", city: "Claremore", sqft: 0, value: 630000, lat: 36.322, lng: -95.615, week: "11/2-11/8", phone: "(918)381-1637", subdivision: "", contact: "Randy Highfill", production: false },
  { id: 15, builder: "Brik Properties", address: "3537 E 100 St", city: "Tulsa", sqft: 4719, value: 615000, lat: 36.02, lng: -95.915, week: "11/2-11/8", phone: "(918)948-5027", subdivision: "Silver Chase", contact: "Tim Sprik", production: false },
  { id: 16, builder: "C G T Builders", address: "2833 E 71 Pl", city: "Wagoner", sqft: 3408, value: 600000, lat: 36.025, lng: -95.69, week: "11/2-11/8", phone: "(469)446-0731", subdivision: "Woodland Hills Estates", contact: "Tom Walker", production: false },
  { id: 17, builder: "Hill House Design & Construction", address: "232 E 46 St", city: "Tulsa", sqft: 4384, value: 600000, lat: 36.126, lng: -95.97, week: "11/16-11/22", phone: "(918)378-4585", subdivision: "Grace Ellen Heights", contact: "Aaron Sprik", production: false },
  { id: 18, builder: "Justin Morgan", address: "211 W 138 St", city: "Jenks", sqft: 3889, value: 582180, lat: 35.978, lng: -95.97, week: "11/16-11/22", phone: "(918)607-9438", subdivision: "Pine Ridge", contact: "", production: false },
  { id: 19, builder: "Birch Company", address: "3101 W 69 Pl", city: "Sapulpa", sqft: 0, value: 575000, lat: 36.003, lng: -96.12, week: "11/2-11/8", phone: "(918)764-8869", subdivision: "", contact: "Brett Davis", production: false },
  { id: 20, builder: "Trail Blazer Homes", address: "19095 E 370 Rd", city: "Chelsea", sqft: 2606, value: 561000, lat: 36.57, lng: -95.47, week: "11/9-11/15", phone: "(918)695-3213", subdivision: "", contact: "Jason Peper", production: false },
  { id: 21, builder: "Whorton Construction", address: "23311 S 4120 Rd", city: "Verdigris", sqft: 3626, value: 532000, lat: 36.01, lng: -95.68, week: "11/2-11/8", phone: "(918)694-4721", subdivision: "", contact: "Tim Whorton", production: false },
  { id: 22, builder: "Concept Builders", address: "1305 Falls Dr", city: "Sapulpa", sqft: 0, value: 520000, lat: 36.007, lng: -96.118, week: "11/2-11/8", phone: "(918)743-4584", subdivision: "", contact: "Toby & Jesse Powell", production: false },
  { id: 23, builder: "Cozort Custom Homes", address: "12229 S 65 Pl", city: "Bixby", sqft: 4291, value: 373317, lat: 35.97, lng: -95.875, week: "11/2-11/8", phone: "(918)899-4346", subdivision: "", contact: "Matt Cozort", production: false },
  { id: 24, builder: "Cozort Custom Homes", address: "6643 E 122 Pl", city: "Bixby", sqft: 4159, value: 361833, lat: 35.965, lng: -95.87, week: "11/2-11/8", phone: "(918)899-4346", subdivision: "Woodmere Estates", contact: "Matt Cozort", production: false },
  { id: 25, builder: "Monroe Design", address: "5715 E 139 St", city: "Bixby", sqft: 7535, value: 460230, lat: 35.96, lng: -95.88, week: "11/2-11/8", phone: "(918)704-8871", subdivision: "", contact: "Jared Newcomb", production: false },
  { id: 26, builder: "Legacy Home Builders", address: "22601 E 107 St", city: "Wagoner", sqft: 2604, value: 465000, lat: 36.015, lng: -95.665, week: "11/2-11/8", phone: "(918)798-4234", subdivision: "Highland Ridge", contact: "Pat Huntley", production: false },
  { id: 27, builder: "Heritage Custom Homes", address: "24555 S Eliza Dr", city: "Claremore", sqft: 3192, value: 462624, lat: 36.31, lng: -95.605, week: "11/16-11/22", phone: "(918)698-7060", subdivision: "Kennedys Park", contact: "", production: false },
  { id: 28, builder: "Concept Builders", address: "1424 E 33 St", city: "Tulsa", sqft: 3697, value: 460000, lat: 36.142, lng: -95.952, week: "11/16-11/22", phone: "(918)743-4584", subdivision: "Olivers", contact: "Toby & Jesse Powell", production: false },
  { id: 29, builder: "B D Properties", address: "4310 E 52 Pl", city: "Tulsa", sqft: 4052, value: 445000, lat: 36.11, lng: -95.93, week: "11/9-11/15", phone: "(405)488-8223", subdivision: "Tanglewood Estates", contact: "Brett Davis", production: false },
  { id: 30, builder: "LaBella Homes", address: "4133 S Detroit Av", city: "Tulsa", sqft: 4163, value: 322260, lat: 36.118, lng: -95.958, week: "11/16-11/22", phone: "(918)855-6433", subdivision: "Demorest", contact: "Julius/Nick Puma", production: false },
  { id: 31, builder: "LaBella Homes", address: "4137 S Detroit Av", city: "Tulsa", sqft: 4143, value: 323047, lat: 36.1182, lng: -95.9582, week: "11/16-11/22", phone: "(918)855-6433", subdivision: "Demorest", contact: "Julius/Nick Puma", production: false },
  { id: 32, builder: "Chasseur Homes", address: "805 S 156 E Av", city: "Tulsa", sqft: 3281, value: 393000, lat: 36.05, lng: -95.815, week: "11/23-11/29", phone: "(918)639-5614", subdivision: "", contact: "Eric Maddox/Hunter Edwards", production: false },
  { id: 33, builder: "BGreen Homes", address: "815 E Gary Pl", city: "Broken Arrow", sqft: 2009, value: 350000, lat: 36.045, lng: -95.798, week: "11/23-11/29", phone: "(918)406-1853", subdivision: "Washington Lane", contact: "Bobby Green", production: false },
  { id: 34, builder: "Sunstone Construction", address: "13453 S 68 E Av", city: "Bixby", sqft: 3528, value: 306936, lat: 35.96, lng: -95.87, week: "11/2-11/8", phone: "(918)500-3299", subdivision: "Rivers Edge", contact: "Bryan Yanzhu", production: false },
  { id: 35, builder: "M & K Remodeling", address: "21020 S 142 E Av", city: "Bixby", sqft: 3510, value: 247428, lat: 35.94, lng: -95.82, week: "11/2-11/8", phone: "(918)813-5012", subdivision: "Bixby Ranch Estates", contact: "Karina Mota Campos", production: false },
  { id: 36, builder: "Butler Homes", address: "7120 E Princeton St", city: "Broken Arrow", sqft: 2897, value: 289700, lat: 36.04, lng: -95.795, week: "11/23-11/29", phone: "(918)824-2700", subdivision: "Creekside @ Forest Ridge", contact: "Travis Butler", production: false },
  { id: 37, builder: "Ketchum Properties", address: "14271 S Delaware Pl", city: "Bixby", sqft: 3179, value: 276573, lat: 35.955, lng: -95.93, week: "11/2-11/8", phone: "(918)637-5090", subdivision: "Presley Heights West", contact: "Casey/Chris Ketchum", production: false },
  { id: 38, builder: "Eaglerock Builders", address: "14820 S Sequoia St", city: "Glenpool", sqft: 2516, value: 250000, lat: 35.955, lng: -96.005, week: "11/23-11/29", phone: "(918)231-5984", subdivision: "", contact: "", production: false },
  { id: 39, builder: "Schuber Mitchell Homes", address: "2096 E 130 Ln", city: "Jenks", sqft: 2156, value: 249600, lat: 35.975, lng: -95.955, week: "11/16-11/22", phone: "(479)802-3000", subdivision: "Frazier Meadows", contact: "", production: false },
  { id: 40, builder: "Brian Wiggs Homes", address: "18006 E 108 St N", city: "Owasso", sqft: 2353, value: 230000, lat: 36.275, lng: -95.83, week: "11/9-11/15", phone: "(918)260-5304", subdivision: "Rolling Meadows Park", contact: "Brian/Cahn Wiggs", production: false },
  { id: 41, builder: "David Brown", address: "23780 S 4190 Rd", city: "Claremore", sqft: 1111, value: 252000, lat: 36.295, lng: -95.59, week: "11/9-11/15", phone: "(918)443-0897", subdivision: "", contact: "", production: false },
  { id: 42, builder: "Dodson Building Group", address: "3712 W Laredo St", city: "Broken Arrow", sqft: 2301, value: 185000, lat: 36.048, lng: -95.82, week: "11/9-11/15", phone: "(918)520-4814", subdivision: "Pine Valley Reserve", contact: "Rick Dodson", production: false },
  { id: 43, builder: "Dodson Building Group", address: "3604 W Laredo St", city: "Broken Arrow", sqft: 2301, value: 185000, lat: 36.0482, lng: -95.8205, week: "11/9-11/15", phone: "(918)520-4814", subdivision: "Pine Valley Reserve", contact: "Rick Dodson", production: false },
  { id: 44, builder: "H2O To Go", address: "10201 E 63 Pl", city: "Tulsa", sqft: 3568, value: 272000, lat: 36.095, lng: -95.89, week: "11/16-11/22", phone: "(702)367-2100", subdivision: "Union Gardens", contact: "Tremayne Anderson", production: false },
  { id: 45, builder: "Show Me How LLC", address: "2714 E 28 St N", city: "Tulsa", sqft: 1718, value: 150000, lat: 36.165, lng: -95.955, week: "11/23-11/29", phone: "", subdivision: "Ben C Franklin", contact: "Sondia Bell", production: false },
  { id: 46, builder: "Potenza Construction", address: "4634 S 29 W Av", city: "Tulsa", sqft: 1230, value: 195000, lat: 36.115, lng: -96.02, week: "11/23-11/29", phone: "(918)852-6717", subdivision: "Carbondale", contact: "Rosideth Bolivar", production: false },
  { id: 47, builder: "True North Homes", address: "15228 S 27 E Av", city: "Tulsa County", sqft: 0, value: 0, lat: 35.96, lng: -95.92, week: "11/23-11/29", phone: "(918)845-1682", subdivision: "Whisper Lane", contact: "Grant Hinkle", production: false },
  { id: 48, builder: "Abbey Homes", address: "15227 S 27 E Av", city: "Tulsa County", sqft: 0, value: 0, lat: 35.961, lng: -95.921, week: "11/23-11/29", phone: "(918)640-7252", subdivision: "Whisper Lane", contact: "Thomas/Connell Curran", production: false },
  { id: 49, builder: "Xtreme Construction", address: "17897 N 97 E Av", city: "Tulsa County", sqft: 0, value: 0, lat: 36.33, lng: -95.85, week: "11/23-11/29", phone: "(214)783-3838", subdivision: "", contact: "", production: false },
  { id: 50, builder: "Southern Homes", address: "15432 S 27 E Av", city: "Tulsa County", sqft: 0, value: 0, lat: 35.958, lng: -95.919, week: "11/9-11/15", phone: "(918)720-3267", subdivision: "Whisper Lane", contact: "Ralph Sandmeyer", production: false },
  { id: 51, builder: "Midwest Quality Builders", address: "17234 S 90 E Av", city: "Bixby", sqft: 2268, value: 193239, lat: 35.92, lng: -95.85, week: "11/2-11/8", phone: "(918)369-9300", subdivision: "", contact: "", production: false },
  { id: 52, builder: "M C 2 Homes", address: "7600 S Sixth St", city: "Broken Arrow", sqft: 3880, value: 732000, lat: 36.038, lng: -95.805, week: "11/16-11/22", phone: "(918)973-2480", subdivision: "Lakes @ Indian Springs", contact: "Josh Ford", production: false },
  { id: 53, builder: "Eaglerock Builders", address: "610 E 149 St", city: "Glenpool", sqft: 2516, value: 250000, lat: 35.952, lng: -96.0, week: "11/16-11/22", phone: "(918)231-5984", subdivision: "Redbud Glen", contact: "", production: false },
  { id: 54, builder: "Alex Zagorodny", address: "14376 Siddiki Av", city: "Skiatook", sqft: 2768, value: 250000, lat: 36.39, lng: -96.02, week: "11/9-11/15", phone: "(918)407-6542", subdivision: "Falls @ Skiatook", contact: "", production: false },
  { id: 55, builder: "Alex Zagorodny", address: "14358 Siddiki Av", city: "Skiatook", sqft: 2357, value: 250000, lat: 36.391, lng: -96.021, week: "11/2-11/8", phone: "(918)407-6542", subdivision: "Falls @ Skiatook", contact: "", production: false },
  { id: 56, builder: "Legacy Home Builders", address: "22725 E 107 St", city: "Wagoner", sqft: 2275, value: 415000, lat: 36.016, lng: -95.664, week: "11/2-11/8", phone: "(918)798-4234", subdivision: "Highland Ridge", contact: "Pat Huntley", production: false },
  { id: 57, builder: "Legacy Home Builders", address: "22803 E 107 St", city: "Wagoner", sqft: 1912, value: 365000, lat: 36.017, lng: -95.663, week: "11/2-11/8", phone: "(918)798-4234", subdivision: "Highland Ridge", contact: "Pat Huntley", production: false },
  { id: 58, builder: "Landmark Homes", address: "20823 S Concord Av", city: "Claremore", sqft: 2390, value: 234000, lat: 36.305, lng: -95.62, week: "11/16-11/22", phone: "(918)232-6189", subdivision: "Birchwood", contact: "Ron Staggs", production: false },
  { id: 59, builder: "Chasseur Homes", address: "805 S 156 E Av", city: "Tulsa", sqft: 3281, value: 393000, lat: 36.05, lng: -95.815, week: "11/23-11/29", phone: "(918)639-5614", subdivision: "", contact: "Eric Maddox", production: false },
  { id: 60, builder: "Brandon Reeves", address: "8947 E Timber Wolf Dr", city: "Wagoner", sqft: 2915, value: 635000, lat: 35.98, lng: -95.67, week: "11/23-11/29", phone: "(918)798-4581", subdivision: "Wolf Creek Estates", contact: "", production: false },

  // ═══ PRODUCTION BUILDERS (aggregated clusters) ═══
  { id: 201, builder: "Rausch-Coleman", address: "Elm Creek subdivision (30+ permits)", city: "Broken Arrow", sqft: 1650, value: 190000, lat: 36.037, lng: -95.783, week: "All Nov", phone: "(918)812-6562", subdivision: "Elm Creek", contact: "Michelle Dockum", production: true },
  { id: 202, builder: "Executive Homes", address: "Multiple subdivisions (15+ permits)", city: "Metro-wide", sqft: 3200, value: 230000, lat: 36.06, lng: -95.85, week: "All Nov", phone: "(918)557-8148", subdivision: "Various", contact: "Taylor Sokolosky", production: true },
  { id: 203, builder: "Simmons Homes", address: "Addison Creek / River Crest (12+ permits)", city: "Bixby/Tulsa", sqft: 2700, value: 220000, lat: 36.0, lng: -95.9, week: "All Nov", phone: "(918)274-0406", subdivision: "Multiple", contact: "Greg Simmons", production: true },
  { id: 204, builder: "Capital Homes", address: "Elysian Fields / Ironwood (8+ permits)", city: "Broken Arrow", sqft: 1800, value: 320000, lat: 36.05, lng: -95.835, week: "All Nov", phone: "(918)274-4200", subdivision: "Multiple", contact: "", production: true },
  { id: 205, builder: "D R Horton", address: "Multiple (6 permits)", city: "Tulsa/Bixby", sqft: 3100, value: 320000, lat: 36.043, lng: -95.975, week: "11/2 & 11/16", phone: "(918)619-2347", subdivision: "Multiple", contact: "Barry Mittasch", production: true },
  { id: 206, builder: "Rausch-Coleman", address: "The Woods (9 permits)", city: "Coweta", sqft: 1870, value: 180000, lat: 35.975, lng: -95.58, week: "11/2-11/8", phone: "(918)812-6562", subdivision: "The Woods", contact: "Michelle Dockum", production: true },
];

export const CITIES = [
  "All", "Tulsa", "Broken Arrow", "Bixby", "Owasso", "Jenks",
  "Claremore", "Wagoner", "Sapulpa", "Glenpool", "Skiatook", "Coweta"
];

export const CITY_COORDS = {
  "All": { center: [-95.85, 36.10], zoom: 10.3 },
  "Tulsa": { center: [-95.94, 36.10], zoom: 11.5 },
  "Broken Arrow": { center: [-95.80, 36.04], zoom: 12 },
  "Bixby": { center: [-95.88, 35.96], zoom: 12 },
  "Owasso": { center: [-95.84, 36.28], zoom: 12 },
  "Jenks": { center: [-95.97, 35.98], zoom: 13 },
  "Claremore": { center: [-95.61, 36.31], zoom: 11.5 },
  "Wagoner": { center: [-95.68, 36.0], zoom: 11 },
  "Sapulpa": { center: [-96.11, 36.0], zoom: 12 },
  "Glenpool": { center: [-96.0, 35.955], zoom: 13 },
  "Skiatook": { center: [-96.02, 36.39], zoom: 12 },
  "Coweta": { center: [-95.58, 35.975], zoom: 12 },
};
