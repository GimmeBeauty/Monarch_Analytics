import { describe, it, expect } from "vitest";
import { parseWindowParam, sumWindow, describeWindow, isMixed, type AttributionDefault } from "./attribution-windows.js";

const def = (channel: string, label: string, days: number | null, unit: string, k7: string | null, k14: string | null, k30: string | null): AttributionDefault =>
  ({ channel, defaultLabel: label, defaultDays: days, defaultUnit: unit, windowKeys: { "7": k7, "14": k14, "30": k30 } });

const META    = def("meta_ads", "7d click + 1d view", 7, "purchases", "7d_click", "7d_click", "28d_click");
const GOOGLE  = def("google_ads", "Google default (7d purchase lookback)", 7, "purchases", "7d", "7d", "7d");
const WSEARCH = def("walmart_connect", "14d", 14, "units", "14d", "14d", "30d");
const ROUNDEL = def("roundel_target", "14d", 14, "orders", null, null, null);
const CRITEO  = def("criteo_ads", "30d click", 30, "orders", null, null, null);
const WDISP   = def("walmart_display", "14d", 14, "transactions", "14d", "14d", "30d");
const TIKTOK  = def("tiktok_ads", "Default (unverified)", null, "orders", null, null, null);
const AMAZON  = def("amazon_ads", "Amazon default", null, "conversions", null, null, null);

describe("parseWindowParam", () => {
  it("treats a missing parameter as default", () => {
    expect(parseWindowParam(undefined)).toBe("default");
    expect(parseWindowParam("")).toBe("default");
  });
  it("accepts the four values and rejects others", () => {
    for (const w of ["default", "7", "14", "30"]) expect(parseWindowParam(w)).toBe(w);
    expect(parseWindowParam("28")).toBeNull();
    expect(parseWindowParam(["7"])).toBeNull();
  });
});

describe("sumWindow", () => {
  it("keeps conversions null only when no day reported them", () => {
    expect(sumWindow([{ date: "2025-12-31", conversions: null, revenue: 10 }]).conversions).toBeNull();
    const t = sumWindow([{ date: "2025-12-31", conversions: null, revenue: 10 }, { date: "2026-01-01", conversions: 3, revenue: 5 }]);
    expect(t).toEqual({ conversions: 3, revenue: 15, nullConversionDays: 1, nullRevenueDays: 0 });
  });
});

describe("describeWindow", () => {
  const data = (key: string, days: number, unit = "purchases", nullConversionDays = 0, nullRevenueDays = 0) =>
    ({ key, days, unit, nullConversionDays, nullRevenueDays });

  it("always chips in platform default and names the unit, with the Google flag", () => {
    expect(describeWindow(META, "default").chip).toBe("7d click + 1d view · purchases");
    expect(describeWindow(GOOGLE, "default").chip).toBe("incl. begin checkout on 8 campaigns · purchases");
    expect(describeWindow(WSEARCH, "default")).toMatchObject({ chip: "14d · units", unit: "units" });
    expect(describeWindow(WDISP, "default").chip).toBe("14d · transactions");
  });
  it("chips Meta only when the window isn't exact, naming the unit", () => {
    expect(describeWindow(META, "7", data("7d_click", 7))).toMatchObject({ exact: true, chip: null });
    expect(describeWindow(META, "14", data("7d_click", 7))).toMatchObject({ exact: false, chip: "7d click · purchases" });
    expect(describeWindow(META, "30", data("28d_click", 28))).toMatchObject({ exact: false, chip: "28d click · purchases" });
  });
  it("caps Google at its 7-day lookback", () => {
    expect(describeWindow(GOOGLE, "7", data("7d", 7)).chip).toBeNull();
    expect(describeWindow(GOOGLE, "14", data("7d", 7)).chip).toBe("7d (lookback max) · purchases");
    expect(describeWindow(GOOGLE, "30", data("7d", 7)).chip).toBe("7d (lookback max) · purchases");
  });
  it("flags Walmart Search orders before 2026 even when the window is exact", () => {
    expect(describeWindow(WSEARCH, "14", data("14d", 14, "orders", 3))).toMatchObject({ exact: true, unit: "orders", chip: "orders n/a before 2026" });
    expect(describeWindow(WSEARCH, "7", data("14d", 14, "orders"))).toMatchObject({ exact: false, chip: "14d · orders" });
  });
  it("keeps fixed windows for channels without window data", () => {
    expect(describeWindow(ROUNDEL, "14")).toMatchObject({ key: "default", exact: true, chip: null });
    expect(describeWindow(ROUNDEL, "30").chip).toBe("14d (fixed) · orders");
    expect(describeWindow(CRITEO, "30").exact).toBe(true);
    expect(describeWindow(CRITEO, "7").chip).toBe("30d click (fixed) · orders");
  });
  it("labels TikTok and Amazon Default (unverified) in every mode", () => {
    for (const w of ["default", "7", "14", "30"] as const) {
      expect(describeWindow(TIKTOK, w)).toMatchObject({ label: "Default (unverified)", chip: "Default (unverified) · orders" });
      expect(describeWindow(AMAZON, w)).toMatchObject({ label: "Default (unverified)", chip: "Default (unverified) · conversions" });
    }
  });
});

describe("isMixed", () => {
  const d = (key: string, days: number, unit: string) => ({ key, days, unit, nullConversionDays: 0, nullRevenueDays: 0 });
  it("ignores units when the windows match", () => {
    const meta = describeWindow(META, "7", d("7d_click", 7, "purchases"));
    const google = describeWindow(GOOGLE, "7", d("7d", 7, "purchases"));
    expect(isMixed([meta, google], "7")).toBe(false);
    expect(isMixed([describeWindow(WSEARCH, "14", d("14d", 14, "orders")), describeWindow(WDISP, "14", d("14d", 14, "transactions")), describeWindow(ROUNDEL, "14")], "14")).toBe(false);
  });
  it("is not mixed when channels share a window other than the one requested", () => {
    expect(isMixed([describeWindow(WSEARCH, "7", d("14d", 14, "orders")), describeWindow(WDISP, "7", d("14d", 14, "transactions"))], "7")).toBe(false);
  });
  it("is mixed when the windows differ, and in default mode when labels differ", () => {
    expect(isMixed([describeWindow(META, "14", d("7d_click", 7, "purchases")), describeWindow(ROUNDEL, "14")], "14")).toBe(true);
    expect(isMixed([describeWindow(META, "7", d("7d_click", 7, "purchases")), describeWindow(TIKTOK, "7")], "7")).toBe(true);
    expect(isMixed([describeWindow(META, "default"), describeWindow(GOOGLE, "default")], "default")).toBe(true);
    expect(isMixed([describeWindow(META, "default")], "default")).toBe(false);
  });
});
