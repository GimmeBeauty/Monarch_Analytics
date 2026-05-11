/**
 * Traffic Data Engine
 * Generates deterministic mock data for the Traffic dashboard:
 * KPIs, product performance, geographic revenue, and store locations.
 */

import { STORES, storeById } from "./storeData";
import { type PricingMode, getWholesaleRate } from "./wholesaleData";

// ─── PRNG ─────────────────────────────────────────────────────────────────────
function makePrng(seed: number): () => number {
  let s = seed >>> 0;
  return () => { s ^= s << 13; s ^= s >> 17; s ^= s << 5; return (s >>> 0) / 0x100000000; };
}
function hashStr(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193) >>> 0;
  return h;
}

// ─── Date Utilities ───────────────────────────────────────────────────────────
function parseDate(s: string): Date { const [y,m,d]=s.split("-").map(Number); return new Date(y,m-1,d); }
function dateToStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function getDaysInRange(start: string, end: string): string[] {
  const days: string[] = []; const s=parseDate(start); const e=parseDate(end); const c=new Date(s);
  while (c<=e) { days.push(dateToStr(new Date(c))); c.setDate(c.getDate()+1); }
  return days;
}
function priorPeriod(start: string, end: string) {
  const s=parseDate(start); const e=parseDate(end);
  const diff=e.getTime()-s.getTime()+86_400_000;
  const pe=new Date(s.getTime()-86_400_000);
  const ps=new Date(pe.getTime()-diff+86_400_000);
  return { start: dateToStr(ps), end: dateToStr(pe) };
}
function numWeeks(start: string, end: string): number {
  const s=parseDate(start); const e=parseDate(end);
  return Math.max(1, Math.round((e.getTime()-s.getTime())/(7*86_400_000)));
}

// ─── Formatting ───────────────────────────────────────────────────────────────
function fmtCurrency(v: number): string {
  if (v>=1_000_000) return `$${(v/1_000_000).toFixed(2)}M`;
  if (v>=1_000) return `$${(v/1_000).toFixed(1)}K`;
  return `$${Math.round(v).toLocaleString()}`;
}
function fmtNumber(v: number): string {
  if (v>=1_000_000) return `${(v/1_000_000).toFixed(1)}M`;
  if (v>=1_000) return `${(v/1_000).toFixed(1)}K`;
  return Math.round(v).toLocaleString();
}
function fmtRatio(v: number): string { return `${v.toFixed(2)}x`; }

// ─── Public Types ─────────────────────────────────────────────────────────────

export interface TrafficParams {
  startDate: string;
  endDate: string;
  selectedStoreIds: string[]; // empty = all
  compareStart?: string;
  compareEnd?: string;
  pricingMode?: PricingMode;
}

export interface TrafficKPI {
  id: string;
  label: string;
  value: number;
  formatted: string;
  change: number;   // % vs prior
  positive: boolean;
  description: string;
}

export interface ProductRow {
  id: string;
  productName: string;
  sku: string;
  upc?: string;
  storeId: string;
  storeName: string;
  storeColor: string;
  sales: number;
  formattedSales: string;
  salesPrior: number;
  units: number;
  unitsPrior: number;
  avgSellPrice: number;
  changeInSales: number;   // %
  conversionRate: number;  // %
  pctSalesOnline: number;  // %
  pageViews: number;
  storeCount?: number;
  isTop10: boolean;
}

export interface StateRevenue {
  code: string;
  name: string;
  revenue: number;
  units: number;
  storeCount: number;
  contribution: number; // 0–100
  band: 0|1|2|3|4|5;   // 0=Very High … 5=Low
}

export interface StoreLocation {
  id: string;
  storeId: string;
  storeName: string;
  storeColor: string;
  sales: number;
  formattedSales: string;
  units: number;
  address: string;
  city: string;
  stateCode: string;
  zipCode: string;
  lat: number;
  lon: number;
}

export interface TrafficData {
  kpis: TrafficKPI[];
  products: ProductRow[];
  stateRevenue: StateRevenue[];
  storeLocations: StoreLocation[];
}

// ─── Product Catalog ──────────────────────────────────────────────────────────

const PRODUCTS = [
  { id: "p01", name: "Daily Defense SPF 30 Moisturizer",     basePrice: 28.99, baseSales: 92000, baseUnits: 3175 },
  { id: "p02", name: "Vitamin C Brightening Serum 30ml",     basePrice: 46.00, baseSales: 84000, baseUnits: 1826 },
  { id: "p03", name: "Hyaluronic Acid Plumping Cream",        basePrice: 34.50, baseSales: 78000, baseUnits: 2261 },
  { id: "p04", name: "Retinol Night Renewal Treatment",       basePrice: 52.00, baseSales: 71000, baseUnits: 1365 },
  { id: "p05", name: "Peptide Eye Repair Gel",                basePrice: 38.00, baseSales: 65000, baseUnits: 1710 },
  { id: "p06", name: "Gentle Micellar Cleansing Balm",        basePrice: 22.00, baseSales: 58000, baseUnits: 2636 },
  { id: "p07", name: "Calming Rose Toning Mist 100ml",        basePrice: 18.50, baseSales: 51000, baseUnits: 2756 },
  { id: "p08", name: "Niacinamide 10% Pore Minimizer",        basePrice: 24.00, baseSales: 48000, baseUnits: 2000 },
  { id: "p09", name: "Mineral Sunscreen SPF 50+",             basePrice: 19.99, baseSales: 44000, baseUnits: 2201 },
  { id: "p10", name: "Vitamin D3 + K2 Softgels 5000 IU",     basePrice: 22.99, baseSales: 42000, baseUnits: 1827 },
  { id: "p11", name: "Omega-3 Fish Oil 1200mg (90ct)",        basePrice: 18.99, baseSales: 38000, baseUnits: 2001 },
  { id: "p12", name: "Collagen Peptides Powder 250g",         basePrice: 39.99, baseSales: 36000, baseUnits: 900  },
  { id: "p13", name: "Daily Probiotic 50B CFU (30ct)",        basePrice: 29.99, baseSales: 33000, baseUnits: 1101 },
  { id: "p14", name: "Biotin Hair Growth Complex 60ct",       basePrice: 24.99, baseSales: 30000, baseUnits: 1200 },
  { id: "p15", name: "Strengthening Keratin Shampoo 300ml",   basePrice: 16.99, baseSales: 28000, baseUnits: 1648 },
  { id: "p16", name: "Deep Moisture Conditioner 300ml",       basePrice: 16.99, baseSales: 26000, baseUnits: 1531 },
  { id: "p17", name: "Firming Body Lotion 200ml",             basePrice: 21.00, baseSales: 24000, baseUnits: 1143 },
  { id: "p18", name: "Intensive Hand Repair Cream 75ml",      basePrice: 12.99, baseSales: 22000, baseUnits: 1693 },
  { id: "p19", name: "Peptide Lip Treatment SPF 15",          basePrice: 14.99, baseSales: 20000, baseUnits: 1334 },
  { id: "p20", name: "Brightening Collagen Eye Patches",      basePrice: 9.99,  baseSales: 18000, baseUnits: 1802 },
] as const;

// Which products each store carries
const STORE_PRODUCTS: Record<string, string[]> = {
  shopify:   ["p01","p02","p03","p04","p05","p06","p07","p08","p09","p10","p11","p12","p13","p14","p15","p16","p17","p18","p19","p20"],
  amazon:    ["p01","p02","p03","p04","p05","p06","p08","p09","p10","p11","p12","p13","p14","p15","p16","p17","p18","p19","p20"],
  walmart:   ["p01","p03","p06","p07","p08","p09","p10","p11","p13","p14","p15","p16","p17","p18"],
  target:    ["p01","p02","p03","p05","p06","p07","p08","p09","p14","p15","p16","p17","p18","p19","p20"],
  kroger:    ["p01","p03","p09","p10","p11","p12","p13","p15","p16","p17","p18"],
  cvs:       ["p01","p02","p05","p06","p08","p09","p10","p11","p13","p18","p19","p20"],
  publix:    ["p01","p03","p09","p10","p11","p13","p15","p16","p17","p18"],
  ulta:      ["p01","p02","p03","p04","p05","p06","p07","p08","p09","p14","p19","p20"],
  walgreens: ["p01","p03","p06","p09","p10","p11","p13","p18","p19","p20"],
};

// Store weight multipliers (revenue share relative to full catalog)
const STORE_SALES_MULTIPLIER: Record<string, number> = {
  shopify: 1.0, amazon: 1.35, walmart: 0.72, target: 0.68,
  kroger: 0.42, cvs: 0.38, publix: 0.32, ulta: 0.28, walgreens: 0.18,
};

// ─── Build Products ───────────────────────────────────────────────────────────

function buildProducts(
  days: string[],
  daysPrior: string[],
  selectedStoreIds: string[],
  pricingMode: PricingMode = "msrp"
): ProductRow[] {
  const effectiveStores = selectedStoreIds.length ? selectedStoreIds : STORES.map(s=>s.id);
  const dayFactor = days.length / 30; // normalise to 30-day period
  const priorFactor = daysPrior.length / 30;

  const rows: ProductRow[] = [];

  for (const storeId of effectiveStores) {
    const store = storeById(storeId);
    if (!store) continue;
    const mult = STORE_SALES_MULTIPLIER[storeId] ?? 0.5;
    const productIds = STORE_PRODUCTS[storeId] ?? [];

    for (const pid of productIds) {
      const product = PRODUCTS.find(p => p.id === pid);
      if (!product) continue;

      const rng  = makePrng(hashStr(`${storeId}|${pid}|sales`));
      const rng2 = makePrng(hashStr(`${storeId}|${pid}|prior`));
      const rng3 = makePrng(hashStr(`${storeId}|${pid}|meta`));

      const noise     = 0.75 + rng()  * 0.50; // ±25%
      const noisePrior= 0.72 + rng2() * 0.56;

      const wsRate     = getWholesaleRate(storeId, pricingMode);
      const sales      = product.baseSales * mult * dayFactor  * noise  * wsRate;
      const salesPrior = product.baseSales * mult * priorFactor* noisePrior * wsRate;
      const units      = Math.round(product.baseUnits * mult * dayFactor  * noise);
      const unitsPrior = Math.round(product.baseUnits * mult * priorFactor* noisePrior);

      const avgSellPrice   = sales > 0 && units > 0 ? sales / units : product.basePrice;
      const changeInSales  = salesPrior > 0 ? ((sales - salesPrior) / salesPrior) * 100 : 0;
      const conversionRate = 1.2 + rng3() * 4.8;   // 1.2–6.0%
      const pctSalesOnline = storeId === "shopify" || storeId === "amazon"
        ? 98 + rng3() * 2
        : 15 + rng3() * 45;
      const pageViews = Math.round(units / (conversionRate / 100) * (0.9 + rng3() * 0.2));

      rows.push({
        id: `${storeId}|${pid}`,
        productName: product.name,
        sku: "",
        storeId,
        storeName: store.label,
        storeColor: store.color,
        sales,
        formattedSales: fmtCurrency(sales),
        salesPrior,
        units,
        unitsPrior,
        avgSellPrice,
        changeInSales,
        conversionRate,
        pctSalesOnline,
        pageViews,
        isTop10: false, // set after sorting
      });
    }
  }

  // Sort by sales desc, mark top 10
  rows.sort((a,b) => b.sales - a.sales);
  rows.forEach((r, i) => { r.isTop10 = i < 10; });

  return rows;
}

// ─── State Revenue Data ───────────────────────────────────────────────────────

// Population-weighted revenue distribution for all 50 states + DC
const STATE_WEIGHTS: Record<string, { name: string; weight: number }> = {
  CA:{ name:"California",      weight:11.8 }, TX:{ name:"Texas",           weight:8.7  },
  FL:{ name:"Florida",         weight:6.6  }, NY:{ name:"New York",         weight:5.9  },
  PA:{ name:"Pennsylvania",    weight:3.8  }, IL:{ name:"Illinois",         weight:3.8  },
  OH:{ name:"Ohio",            weight:3.5  }, GA:{ name:"Georgia",          weight:3.2  },
  NC:{ name:"North Carolina",  weight:3.2  }, MI:{ name:"Michigan",         weight:3.0  },
  NJ:{ name:"New Jersey",      weight:2.7  }, VA:{ name:"Virginia",         weight:2.5  },
  WA:{ name:"Washington",      weight:2.3  }, AZ:{ name:"Arizona",          weight:2.2  },
  MA:{ name:"Massachusetts",   weight:2.1  }, TN:{ name:"Tennessee",        weight:2.1  },
  IN:{ name:"Indiana",         weight:2.0  }, MO:{ name:"Missouri",         weight:1.8  },
  MD:{ name:"Maryland",        weight:1.8  }, WI:{ name:"Wisconsin",        weight:1.7  },
  CO:{ name:"Colorado",        weight:1.7  }, MN:{ name:"Minnesota",        weight:1.7  },
  SC:{ name:"South Carolina",  weight:1.6  }, AL:{ name:"Alabama",          weight:1.5  },
  LA:{ name:"Louisiana",       weight:1.4  }, KY:{ name:"Kentucky",         weight:1.3  },
  OR:{ name:"Oregon",          weight:1.3  }, OK:{ name:"Oklahoma",         weight:1.2  },
  CT:{ name:"Connecticut",     weight:1.1  }, UT:{ name:"Utah",             weight:1.0  },
  NV:{ name:"Nevada",          weight:0.95 }, IA:{ name:"Iowa",             weight:0.95 },
  AR:{ name:"Arkansas",        weight:0.9  }, MS:{ name:"Mississippi",      weight:0.9  },
  KS:{ name:"Kansas",          weight:0.88 }, NM:{ name:"New Mexico",       weight:0.63 },
  NE:{ name:"Nebraska",        weight:0.60 }, ID:{ name:"Idaho",            weight:0.57 },
  WV:{ name:"West Virginia",   weight:0.54 }, HI:{ name:"Hawaii",           weight:0.42 },
  NH:{ name:"New Hampshire",   weight:0.42 }, ME:{ name:"Maine",            weight:0.42 },
  MT:{ name:"Montana",         weight:0.33 }, RI:{ name:"Rhode Island",     weight:0.33 },
  DE:{ name:"Delaware",        weight:0.30 }, SD:{ name:"South Dakota",     weight:0.27 },
  ND:{ name:"North Dakota",    weight:0.23 }, AK:{ name:"Alaska",           weight:0.22 },
  VT:{ name:"Vermont",         weight:0.19 }, WY:{ name:"Wyoming",          weight:0.17 },
  DC:{ name:"Dist. of Columbia",weight:0.21 },
};

function buildStateRevenue(totalRevenue: number): StateRevenue[] {
  const totalWeight = Object.values(STATE_WEIGHTS).reduce((s,w)=>s+w.weight,0);
  const rows = Object.entries(STATE_WEIGHTS).map(([code, sw]) => {
    const rng = makePrng(hashStr(`state|${code}`));
    const noise = 0.82 + rng() * 0.36;
    const revenue = (sw.weight / totalWeight) * totalRevenue * noise;
    const units = Math.round(revenue / 28.5); // avg unit price
    return { code, name: sw.name, revenue, units };
  });

  const total = rows.reduce((s,r)=>s+r.revenue,0);
  rows.forEach(r => { (r as any).contribution = total>0 ? (r.revenue/total)*100 : 0; });

  // Assign quantile bands
  const sorted = [...rows].sort((a,b)=>b.revenue-a.revenue);
  const n = sorted.length;
  sorted.forEach((r,i) => {
    const pct = i/n;
    let band: 0|1|2|3|4|5;
    if      (pct < 0.10) band = 0;
    else if (pct < 0.22) band = 1;
    else if (pct < 0.40) band = 2;
    else if (pct < 0.60) band = 3;
    else if (pct < 0.78) band = 4;
    else                 band = 5;
    (r as any).band = band;
  });

  return rows as StateRevenue[];
}

// ─── Store Locations ──────────────────────────────────────────────────────────

// Each physical store has locations in key states (DTC/online stores get no locations)
const RAW_LOCATIONS: Array<{
  storeId: string; address: string; city: string; stateCode: string; zip: string; lat: number; lon: number;
}> = [
  // Walmart
  { storeId:"walmart", address:"702 SW 8th St",       city:"Bentonville",   stateCode:"AR", zip:"72712", lat:36.37, lon:-94.21 },
  { storeId:"walmart", address:"1501 N University Ave",city:"Little Rock",   stateCode:"AR", zip:"72207", lat:34.77, lon:-92.35 },
  { storeId:"walmart", address:"4325 Glenwood Ave",    city:"Raleigh",       stateCode:"NC", zip:"27612", lat:35.83, lon:-78.65 },
  { storeId:"walmart", address:"8300 N Tryon St",      city:"Charlotte",     stateCode:"NC", zip:"28262", lat:35.33, lon:-80.74 },
  { storeId:"walmart", address:"1500 Market St",       city:"Philadelphia",  stateCode:"PA", zip:"19102", lat:39.95, lon:-75.17 },
  { storeId:"walmart", address:"2500 Fernandina Rd",   city:"Columbia",      stateCode:"SC", zip:"29212", lat:34.06, lon:-81.15 },
  { storeId:"walmart", address:"4150 Eastgate Blvd",   city:"Cincinnati",    stateCode:"OH", zip:"45245", lat:39.10, lon:-84.27 },
  { storeId:"walmart", address:"2001 S Stemmons Fwy",  city:"Lewisville",    stateCode:"TX", zip:"75067", lat:33.04, lon:-97.01 },
  { storeId:"walmart", address:"901 W Bethel Rd",      city:"Coppell",       stateCode:"TX", zip:"75019", lat:32.97, lon:-97.01 },
  { storeId:"walmart", address:"3825 Clearview Pkwy",  city:"Metairie",      stateCode:"LA", zip:"70006", lat:30.00, lon:-90.13 },
  { storeId:"walmart", address:"1201 Lake Woodlands Dr",city:"The Woodlands",stateCode:"TX", zip:"77380", lat:30.17, lon:-95.47 },
  { storeId:"walmart", address:"200 Walmart Way",      city:"Secaucus",      stateCode:"NJ", zip:"07094", lat:40.79, lon:-74.07 },
  // Target
  { storeId:"target", address:"1000 Nicollet Mall",    city:"Minneapolis",   stateCode:"MN", zip:"55403", lat:44.97, lon:-93.27 },
  { storeId:"target", address:"3535 Peachtree Rd NE",  city:"Atlanta",       stateCode:"GA", zip:"30326", lat:33.84, lon:-84.36 },
  { storeId:"target", address:"2600 W Camelback Rd",   city:"Phoenix",       stateCode:"AZ", zip:"85017", lat:33.51, lon:-112.10 },
  { storeId:"target", address:"11051 Foothill Blvd",   city:"Rancho Cucamonga",stateCode:"CA",zip:"91730",lat:34.10, lon:-117.59 },
  { storeId:"target", address:"5201 Transit Rd",       city:"Buffalo",       stateCode:"NY", zip:"14221", lat:42.94, lon:-78.73 },
  { storeId:"target", address:"12100 Jefferson Ave",   city:"Newport News",  stateCode:"VA", zip:"23602", lat:37.14, lon:-76.53 },
  { storeId:"target", address:"8900 N Michigan Rd",    city:"Indianapolis",  stateCode:"IN", zip:"46268", lat:39.92, lon:-86.22 },
  { storeId:"target", address:"1850 W 49th St",        city:"Hialeah",       stateCode:"FL", zip:"33012", lat:25.88, lon:-80.31 },
  { storeId:"target", address:"7100 NE 45th St",       city:"Kansas City",   stateCode:"MO", zip:"64117", lat:39.10, lon:-94.54 },
  { storeId:"target", address:"1420 S Congress Ave",   city:"Austin",        stateCode:"TX", zip:"78704", lat:30.25, lon:-97.75 },
  // Kroger
  { storeId:"kroger", address:"1014 Vine St",          city:"Cincinnati",    stateCode:"OH", zip:"45202", lat:39.11, lon:-84.51 },
  { storeId:"kroger", address:"4500 Six Forks Rd",     city:"Raleigh",       stateCode:"NC", zip:"27609", lat:35.85, lon:-78.64 },
  { storeId:"kroger", address:"2620 N Central Expwy",  city:"Plano",         stateCode:"TX", zip:"75075", lat:33.03, lon:-96.73 },
  { storeId:"kroger", address:"1275 Caroline St NE",   city:"Atlanta",       stateCode:"GA", zip:"30307", lat:33.77, lon:-84.36 },
  { storeId:"kroger", address:"6900 Lake Ellenor Dr",  city:"Orlando",       stateCode:"FL", zip:"32809", lat:28.48, lon:-81.39 },
  { storeId:"kroger", address:"3535 Park East Dr",     city:"Beachwood",     stateCode:"OH", zip:"44122", lat:41.47, lon:-81.51 },
  { storeId:"kroger", address:"3840 Wards Corner Rd",  city:"Louisville",    stateCode:"KY", zip:"40241", lat:38.30, lon:-85.56 },
  { storeId:"kroger", address:"9150 Leesburg Pike",    city:"Vienna",        stateCode:"VA", zip:"22182", lat:38.90, lon:-77.26 },
  // CVS
  { storeId:"cvs", address:"1 CVS Dr",                 city:"Woonsocket",    stateCode:"RI", zip:"02895", lat:41.99, lon:-71.51 },
  { storeId:"cvs", address:"225 Water St",             city:"New York",      stateCode:"NY", zip:"10038", lat:40.71, lon:-74.01 },
  { storeId:"cvs", address:"2100 Pennsylvania Ave NW", city:"Washington",    stateCode:"DC", zip:"20037", lat:38.90, lon:-77.05 },
  { storeId:"cvs", address:"8200 Wisconsin Ave",       city:"Bethesda",      stateCode:"MD", zip:"20814", lat:39.00, lon:-77.10 },
  { storeId:"cvs", address:"1776 Peachtree St NW",     city:"Atlanta",       stateCode:"GA", zip:"30309", lat:33.80, lon:-84.39 },
  { storeId:"cvs", address:"401 N Michigan Ave",       city:"Chicago",       stateCode:"IL", zip:"60611", lat:41.89, lon:-87.63 },
  { storeId:"cvs", address:"9370 W Olympic Blvd",      city:"Beverly Hills", stateCode:"CA", zip:"90212", lat:34.06, lon:-118.41 },
  { storeId:"cvs", address:"6400 N Dale Mabry Hwy",    city:"Tampa",         stateCode:"FL", zip:"33614", lat:28.01, lon:-82.50 },
  { storeId:"cvs", address:"600 Providence Hwy",       city:"Dedham",        stateCode:"MA", zip:"02026", lat:42.25, lon:-71.18 },
  { storeId:"cvs", address:"1775 E University Dr",     city:"Tempe",         stateCode:"AZ", zip:"85281", lat:33.43, lon:-111.90 },
  // Publix
  { storeId:"publix", address:"3300 Publix Corporate Pkwy",city:"Lakeland",  stateCode:"FL", zip:"33811", lat:27.97, lon:-81.94 },
  { storeId:"publix", address:"1000 Lincoln Rd",        city:"Miami Beach",  stateCode:"FL", zip:"33139", lat:25.79, lon:-80.14 },
  { storeId:"publix", address:"1140 US-1 S",            city:"Tequesta",     stateCode:"FL", zip:"33469", lat:26.96, lon:-80.10 },
  { storeId:"publix", address:"2875 N Druid Hills Rd",  city:"Atlanta",      stateCode:"GA", zip:"30329", lat:33.81, lon:-84.33 },
  { storeId:"publix", address:"4725 Harding Pike",      city:"Nashville",    stateCode:"TN", zip:"37205", lat:36.11, lon:-86.86 },
  { storeId:"publix", address:"1400 Beville Rd",        city:"Daytona Beach",stateCode:"FL", zip:"32119", lat:29.14, lon:-81.03 },
  { storeId:"publix", address:"3600 Airport Blvd",      city:"Mobile",       stateCode:"AL", zip:"36608", lat:30.70, lon:-88.17 },
  { storeId:"publix", address:"790 N Monroe St",        city:"Tallahassee",  stateCode:"FL", zip:"32303", lat:30.44, lon:-84.30 },
  // Ulta Beauty
  { storeId:"ulta", address:"1000 Remington Blvd",      city:"Bolingbrook",  stateCode:"IL", zip:"60440", lat:41.69, lon:-88.08 },
  { storeId:"ulta", address:"200 Cahaba Valley Rd",     city:"Pelham",       stateCode:"AL", zip:"35124", lat:33.33, lon:-86.79 },
  { storeId:"ulta", address:"1800 Rosecrans Ave",       city:"Manhattan Beach",stateCode:"CA",zip:"90266",lat:33.87, lon:-118.39 },
  { storeId:"ulta", address:"2100 Pleasant Hill Rd",    city:"Duluth",       stateCode:"GA", zip:"30096", lat:33.96, lon:-84.14 },
  { storeId:"ulta", address:"15720 NW 67th Ave",        city:"Miami Lakes",  stateCode:"FL", zip:"33014", lat:25.92, lon:-80.32 },
  { storeId:"ulta", address:"6930 Foss Ave",            city:"Oklahoma City",stateCode:"OK", zip:"73132", lat:35.55, lon:-97.65 },
  { storeId:"ulta", address:"1700 Galleria Blvd",       city:"Charlotte",    stateCode:"NC", zip:"28270", lat:35.06, lon:-80.82 },
  { storeId:"ulta", address:"1380 N Wheeling Rd",       city:"Mount Prospect",stateCode:"IL",zip:"60056", lat:42.06, lon:-87.94 },
  // Walgreens
  { storeId:"walgreens", address:"200 Wilmot Rd",       city:"Deerfield",    stateCode:"IL", zip:"60015", lat:42.17, lon:-87.87 },
  { storeId:"walgreens", address:"750 N Michigan Ave",  city:"Chicago",      stateCode:"IL", zip:"60611", lat:41.90, lon:-87.63 },
  { storeId:"walgreens", address:"1524 N Broad St",     city:"Philadelphia", stateCode:"PA", zip:"19121", lat:39.98, lon:-75.15 },
  { storeId:"walgreens", address:"3015 S Las Vegas Blvd",city:"Las Vegas",   stateCode:"NV", zip:"89109", lat:36.12, lon:-115.17 },
  { storeId:"walgreens", address:"2101 Westlake Ave N", city:"Seattle",      stateCode:"WA", zip:"98109", lat:47.63, lon:-122.36 },
  { storeId:"walgreens", address:"4025 Woodfield Blvd", city:"Schaumburg",   stateCode:"IL", zip:"60173", lat:42.02, lon:-88.01 },
  { storeId:"walgreens", address:"8270 W Flagler St",   city:"Miami",        stateCode:"FL", zip:"33144", lat:25.77, lon:-80.34 },
  { storeId:"walgreens", address:"303 W Madison St",    city:"Chicago",      stateCode:"IL", zip:"60606", lat:41.88, lon:-87.63 },
];

function buildStoreLocations(
  totalRevenue: number,
  selectedStoreIds: string[]
): StoreLocation[] {
  const effectiveStores = new Set(selectedStoreIds.length ? selectedStoreIds : STORES.map(s=>s.id));

  return RAW_LOCATIONS
    .filter(l => effectiveStores.has(l.storeId))
    .map((l, i) => {
      const store = storeById(l.storeId)!;
      const rng = makePrng(hashStr(`loc|${l.storeId}|${i}`));
      const locShare = 0.002 + rng() * 0.015;
      const sales = totalRevenue * locShare;
      const units = Math.round(sales / 25.5);
      return {
        id: `loc_${l.storeId}_${i}`,
        storeId: l.storeId,
        storeName: store.label,
        storeColor: store.color,
        sales,
        formattedSales: fmtCurrency(sales),
        units,
        address: l.address,
        city: l.city,
        stateCode: l.stateCode,
        zipCode: l.zip,
        lat: l.lat,
        lon: l.lon,
      };
    });
}

// ─── KPI Builder ──────────────────────────────────────────────────────────────

function buildKPIs(
  totalRevenue: number, totalRevenuePrior: number,
  totalUnits: number, totalUnitsPrior: number,
  totalAdSales: number, totalAdSalesPrior: number,
  totalAdSpend: number,
  numStores: number, weeks: number
): TrafficKPI[] {
  const pct = (c: number, p: number) => p===0 ? 0 : Math.round(((c-p)/p)*1000)/10;

  const pspw = numStores>0 && weeks>0 ? totalRevenue/(numStores*weeks) : 0;
  const pspwPrior = numStores>0 && weeks>0 ? totalRevenuePrior/(numStores*weeks) : 0;
  const mer = totalAdSpend>0 ? totalRevenue/totalAdSpend : 0;
  const merPrior = totalAdSpend>0 ? totalRevenuePrior/totalAdSpend : 0;
  const adRevenue = totalAdSales * 0.88; // net after returns
  const adRevenuePrior = totalAdSalesPrior * 0.88;

  return [
    { id:"revenue",   label:"Revenue",       value:totalRevenue,    formatted:fmtCurrency(totalRevenue),    change:pct(totalRevenue,totalRevenuePrior),     positive:true,  description:"Total net revenue across all selected stores" },
    { id:"units",     label:"Units Sold",    value:totalUnits,      formatted:fmtNumber(totalUnits),        change:pct(totalUnits,totalUnitsPrior),          positive:true,  description:"Units sold across selected stores and date range" },
    { id:"pspw",      label:"$PSPW",         value:pspw,            formatted:fmtCurrency(pspw),            change:pct(pspw,pspwPrior),                     positive:true,  description:"Per Store Per Week — Revenue ÷ Stores ÷ Weeks" },
    { id:"adSales",   label:"Ad Sales",      value:totalAdSales,    formatted:fmtCurrency(totalAdSales),    change:pct(totalAdSales,totalAdSalesPrior),      positive:true,  description:"Revenue attributable to paid advertising" },
    { id:"adRevenue", label:"Ad Revenue",    value:adRevenue,       formatted:fmtCurrency(adRevenue),       change:pct(adRevenue,adRevenuePrior),            positive:true,  description:"Ad Sales net of returns and adjustments" },
    { id:"mer",       label:"MER",           value:mer,             formatted:fmtRatio(mer),                change:pct(mer,merPrior),                        positive:true,  description:"Marketing Efficiency Ratio — Revenue ÷ Ad Spend" },
  ];
}

// ─── Main Export ──────────────────────────────────────────────────────────────

const STORE_REVENUE_BASELINE: Record<string, number> = {
  shopify:52000, amazon:65000, walmart:38000, target:32000,
  kroger:21000, cvs:19000, publix:16000, ulta:13000, walgreens:9000,
};

// Adstock trend (same as overviewData)
const BASE_EPOCH_MS = new Date("2024-01-01").getTime();
function trendFactor(dateStr: string): number {
  return 1 + ((parseDate(dateStr).getTime()-BASE_EPOCH_MS)/(365.25*86_400_000))*0.18;
}

function aggregateRevenue(days: string[], storeIds: string[], pricingMode: PricingMode = "msrp"): { revenue: number; units: number } {
  let revenue=0, units=0;
  for (const date of days) {
    const tf = trendFactor(date);
    for (const sid of storeIds) {
      const base = STORE_REVENUE_BASELINE[sid] ?? 0;
      const rng = makePrng(hashStr(`${sid}|${date}`));
      const noise = 0.85 + rng() * 0.30;
      const rev = base * tf * noise * getWholesaleRate(sid, pricingMode);
      revenue += rev;
      units += Math.round(rev / 27.5);
    }
  }
  return { revenue, units };
}

export function generateTrafficData(params: TrafficParams): TrafficData {
  const { startDate, endDate, selectedStoreIds, pricingMode = "msrp" } = params;
  const effectiveStores = selectedStoreIds.length ? selectedStoreIds : STORES.map(s=>s.id);

  const prior = params.compareStart && params.compareEnd
    ? { start: params.compareStart, end: params.compareEnd }
    : priorPeriod(startDate, endDate);

  const days      = getDaysInRange(startDate, endDate);
  const daysPrior = getDaysInRange(prior.start, prior.end);
  const weeks     = numWeeks(startDate, endDate);

  const { revenue, units }             = aggregateRevenue(days, effectiveStores, pricingMode);
  const { revenue: revPrior, units: unitsPrior } = aggregateRevenue(daysPrior, effectiveStores, pricingMode);

  const adSalesRatio = 0.28 + effectiveStores.length * 0.01;
  const adSpendRatio = 0.07;
  const totalAdSales = revenue * adSalesRatio;
  const totalAdSalesPrior = revPrior * adSalesRatio;
  const totalAdSpend = revenue * adSpendRatio;

  const kpis = buildKPIs(
    revenue, revPrior, units, unitsPrior,
    totalAdSales, totalAdSalesPrior, totalAdSpend,
    effectiveStores.length, weeks
  );

  const products = buildProducts(days, daysPrior, selectedStoreIds, pricingMode);
  const stateRevenue = buildStateRevenue(revenue);
  const storeLocations = buildStoreLocations(revenue, selectedStoreIds);

  return { kpis, products, stateRevenue, storeLocations };
}
