import { useState, useRef, useEffect } from "react";
import { Blend, LayoutDashboard, FileSpreadsheet, RefreshCw, Check, Upload, X, AlertCircle } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface SkuRow {
  sku: string;
  costPerItem: number;
}

interface FinancialConfig {
  blendedCogsPercent: number;
  avgShippingCostPerOrder: number;
  paymentGatewayPercent: number;
  gatewayFixedFeePerTxn: number;
  refundRatePercent: number;
  fixedMonthlyExpenses: number;
  variableCostPercent: number;
  skuRows: SkuRow[];
}

const STORAGE_KEY = "monarch-financial-settings";

function loadConfig(): FinancialConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {
    blendedCogsPercent: 50,
    avgShippingCostPerOrder: 0,
    paymentGatewayPercent: 2.9,
    gatewayFixedFeePerTxn: 0.30,
    refundRatePercent: 0,
    fixedMonthlyExpenses: 0,
    variableCostPercent: 0,
    skuRows: [],
  };
}

function saveConfig(cfg: FinancialConfig) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
}

// ─── Input helpers ────────────────────────────────────────────────────────────

interface FieldProps {
  label: string;
  hint?: string;
  prefix?: string;
  suffix?: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
  placeholder?: string;
}

function NumericField({ label, hint, prefix, suffix, value, onChange, step = 0.01, min = 0, max, placeholder }: FieldProps) {
  const [raw, setRaw] = useState(String(value));

  useEffect(() => {
    setRaw(String(value));
  }, [value]);

  const commit = () => {
    const n = parseFloat(raw);
    if (!isNaN(n)) {
      const clamped = max !== undefined ? Math.min(n, max) : Math.max(n, min ?? 0);
      onChange(clamped);
      setRaw(String(clamped));
    } else {
      setRaw(String(value));
    }
  };

  return (
    <div>
      <label className="block text-sm font-semibold text-[#3A3A3A] dark:text-[#FFF9F2] mb-2">
        {label}
      </label>
      <div className="flex items-center rounded-lg border border-[#FFBC80]/40 bg-[#FFF9F2] dark:bg-[#1a1208] overflow-hidden focus-within:border-[#FFBC80] transition-colors">
        {prefix && (
          <span className="pl-3 pr-1 text-sm font-medium text-[#3A3A3A]/50 dark:text-[#FFF9F2]/40 select-none">
            {prefix}
          </span>
        )}
        <input
          type="number"
          step={step}
          min={min}
          max={max}
          value={raw}
          placeholder={placeholder}
          onChange={(e) => setRaw(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === "Enter" && commit()}
          className="flex-1 px-3 py-2.5 text-sm bg-transparent text-[#3A3A3A] dark:text-[#FFF9F2] outline-none min-w-0"
          style={{ MozAppearance: "textfield" } as React.CSSProperties}
        />
        {suffix && (
          <span className="pr-3 pl-1 text-sm font-medium text-[#3A3A3A]/50 dark:text-[#FFF9F2]/40 select-none">
            {suffix}
          </span>
        )}
      </div>
      {hint && <p className="mt-1.5 text-xs text-[#3A3A3A]/45 dark:text-[#FFF9F2]/35">{hint}</p>}
    </div>
  );
}

// ─── Section card ─────────────────────────────────────────────────────────────

function SectionCard({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[#FFBC80]/30 bg-white dark:bg-[#231a0e] overflow-hidden">
      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-[#FFBC80]/15">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, #FFBC80, #FFE29A)" }}>
          <Icon size={14} className="text-[#3A3A3A]" strokeWidth={2.5} />
        </div>
        <h3 className="text-sm font-bold text-[#3A3A3A] dark:text-[#FFF9F2]">{title}</h3>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

// ─── CSV Parser ───────────────────────────────────────────────────────────────

function parseCsv(text: string): SkuRow[] {
  const lines = text.trim().split("\n");
  const rows: SkuRow[] = [];
  for (const line of lines) {
    const parts = line.split(",").map((s) => s.trim().replace(/^"|"$/g, ""));
    if (parts.length < 2) continue;
    const sku = parts[0];
    const cost = parseFloat(parts[1]);
    if (sku && !isNaN(cost)) rows.push({ sku, costPerItem: cost });
  }
  return rows;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function FinancialSettings({ readOnly = false }: { readOnly?: boolean }) {
  const [cfg, setCfg] = useState<FinancialConfig>(loadConfig);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [csvError, setCsvError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const set = <K extends keyof FinancialConfig>(key: K) => (val: FinancialConfig[K]) => {
    setCfg((prev) => ({ ...prev, [key]: val }));
  };

  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvError(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const rows = parseCsv(text);
      if (rows.length === 0) {
        setCsvError("No valid rows found. Make sure the format is: SKU, Cost Per Item");
        return;
      }
      setCfg((prev) => ({ ...prev, skuRows: rows }));
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleSaveRecalculate = async () => {
    setStatus("saving");
    saveConfig(cfg);
    // Simulate recalculation delay
    await new Promise((r) => setTimeout(r, 900));
    setStatus("saved");
    setTimeout(() => setStatus("idle"), 3000);
  };

  return (
    <div className={`space-y-5 ${readOnly ? "pointer-events-none select-none opacity-75" : ""}`}>
      <div>
        <h2 className="text-base font-bold text-[#3A3A3A] dark:text-[#FFF9F2]">Financial Settings</h2>
        <p className="text-xs text-[#3A3A3A]/50 dark:text-[#FFF9F2]/40 mt-0.5">
          Configure cost inputs to calculate true contribution margins across all orders.
        </p>
      </div>

      {/* Blended Costs */}
      <SectionCard icon={Blend} title="Blended Costs">
        <div className="grid grid-cols-2 gap-x-6 gap-y-5">
          <NumericField
            label="Blended COGS %"
            hint="Default cost of goods as % of revenue"
            suffix="%"
            value={cfg.blendedCogsPercent}
            onChange={set("blendedCogsPercent")}
            max={100}
          />
          <NumericField
            label="Avg Shipping Cost / Order"
            prefix="$"
            value={cfg.avgShippingCostPerOrder}
            onChange={set("avgShippingCostPerOrder")}
          />
          <NumericField
            label="Payment Gateway %"
            hint="e.g. Stripe 2.9%"
            suffix="%"
            value={cfg.paymentGatewayPercent}
            onChange={set("paymentGatewayPercent")}
            max={100}
          />
          <NumericField
            label="Gateway Fixed Fee / Txn"
            hint="e.g. $0.30 per transaction"
            prefix="$"
            value={cfg.gatewayFixedFeePerTxn}
            onChange={set("gatewayFixedFeePerTxn")}
          />
          <div className="col-span-1">
            <NumericField
              label="Refund Rate %"
              hint="Optional — estimated refund rate"
              suffix="%"
              value={cfg.refundRatePercent}
              onChange={set("refundRatePercent")}
              max={100}
            />
          </div>
        </div>
      </SectionCard>

      {/* Overhead */}
      <SectionCard icon={LayoutDashboard} title="Overhead">
        <div className="grid grid-cols-2 gap-x-6 gap-y-5">
          <NumericField
            label="Fixed Monthly Expenses"
            hint="Software, rent, salaries, etc."
            prefix="$"
            value={cfg.fixedMonthlyExpenses}
            onChange={set("fixedMonthlyExpenses")}
            step={1}
          />
          <NumericField
            label="Variable Cost %"
            hint="Marketing overhead as % of revenue"
            suffix="%"
            value={cfg.variableCostPercent}
            onChange={set("variableCostPercent")}
            max={100}
          />
        </div>
      </SectionCard>

      {/* SKU-Level COGS */}
      <SectionCard icon={FileSpreadsheet} title="SKU-Level COGS (Optional)">
        <p className="text-xs text-[#3A3A3A]/55 dark:text-[#FFF9F2]/45 mb-4 leading-relaxed">
          Upload a CSV with SKU-specific costs. When available, these override the blended COGS % above.
          <br />
          <span className="font-mono text-[10px] px-1.5 py-0.5 rounded mt-1 inline-block bg-[#FFBC80]/15 text-[#3A3A3A]/70 dark:text-[#FFF9F2]/55">
            Format: SKU, Cost Per Item
          </span>
        </p>

        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[#FFBC80]/50 text-sm font-semibold text-[#3A3A3A] dark:text-[#FFF9F2] hover:bg-[#FFBC80]/10 transition-colors"
          >
            <Upload size={14} strokeWidth={2.5} />
            Upload CSV
          </button>
          <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleCsvUpload} />

          {cfg.skuRows.length > 0 && (
            <span className="text-xs text-[#3A3A3A]/55 dark:text-[#FFF9F2]/45">
              {cfg.skuRows.length} SKU{cfg.skuRows.length !== 1 ? "s" : ""} loaded
            </span>
          )}
        </div>

        {csvError && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/40 mb-4">
            <AlertCircle size={14} className="text-red-500 mt-0.5 shrink-0" />
            <p className="text-xs text-red-600 dark:text-red-400">{csvError}</p>
          </div>
        )}

        {cfg.skuRows.length > 0 && (
          <div className="rounded-lg border border-[#FFBC80]/20 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 bg-[#FFF9F2] dark:bg-[#1a1208] border-b border-[#FFBC80]/20">
              <p className="text-[11px] font-bold tracking-wider text-[#3A3A3A]/50 dark:text-[#FFF9F2]/40 uppercase">SKU Data</p>
              <button
                onClick={() => setCfg((prev) => ({ ...prev, skuRows: [] }))}
                className="flex items-center gap-1 text-xs text-[#3A3A3A]/45 dark:text-[#FFF9F2]/35 hover:text-red-500 transition-colors"
              >
                <X size={11} /> Clear
              </button>
            </div>
            <div className="max-h-52 overflow-y-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[#FFBC80]/15">
                    <th className="px-4 py-2 text-left font-semibold text-[#3A3A3A]/50 dark:text-[#FFF9F2]/40">SKU</th>
                    <th className="px-4 py-2 text-right font-semibold text-[#3A3A3A]/50 dark:text-[#FFF9F2]/40">Cost Per Item</th>
                  </tr>
                </thead>
                <tbody>
                  {cfg.skuRows.map((row, i) => (
                    <tr key={i} className={`border-b border-[#FFBC80]/10 last:border-0 ${i % 2 === 0 ? "" : "bg-[#FFBC80]/5"}`}>
                      <td className="px-4 py-2 font-mono text-[#3A3A3A] dark:text-[#FFF9F2]">{row.sku}</td>
                      <td className="px-4 py-2 text-right text-[#3A3A3A] dark:text-[#FFF9F2]">${row.costPerItem.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </SectionCard>

      {/* Save & Recalculate */}
      <div className="rounded-xl border border-[#FFBC80]/30 bg-white dark:bg-[#231a0e] p-5">
        <div className="flex items-center gap-2.5 mb-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, #FFBC80, #FFE29A)" }}>
            <RefreshCw size={14} className="text-[#3A3A3A]" strokeWidth={2.5} />
          </div>
          <h3 className="text-sm font-bold text-[#3A3A3A] dark:text-[#FFF9F2]">Save & Recalculate</h3>
        </div>
        <p className="text-xs text-[#3A3A3A]/55 dark:text-[#FFF9F2]/45 mb-4 ml-[38px]">
          Save your settings and recalculate contribution margins for all orders. This feeds into your attribution models.
        </p>
        <div className="ml-[38px]">
          <button
            onClick={handleSaveRecalculate}
            disabled={status === "saving" || readOnly}
            className="flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold text-[#3A3A3A] hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: "linear-gradient(135deg, #FFBC80, #FFE29A)" }}
          >
            {status === "saving" && (
              <RefreshCw size={14} strokeWidth={2.5} className="animate-spin" />
            )}
            {status === "saved" && (
              <Check size={14} strokeWidth={2.5} />
            )}
            {status === "idle" && (
              <RefreshCw size={14} strokeWidth={2.5} />
            )}
            {status === "saving" ? "Recalculating…" : status === "saved" ? "Recalculated!" : "Save & Recalculate"}
          </button>
          {status === "saved" && (
            <p className="mt-2 text-xs text-[#3A3A3A]/50 dark:text-[#FFF9F2]/40">
              Contribution margins updated across all attribution models.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
