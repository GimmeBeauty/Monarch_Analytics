import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from "recharts";

interface TimeSeriesPoint {
  date: string;
  value: number;
  compareValue?: number;
}

interface AreaChartProps {
  type: "area";
  data: TimeSeriesPoint[];
  compareEnabled?: boolean;
  label?: string;
  valuePrefix?: string;
  valueSuffix?: string;
  height?: number;
}

interface BarChartProps {
  type: "bar";
  data: Array<{ label: string; value: number; value2?: number }>;
  height?: number;
}

interface LineChartProps {
  type: "line";
  data: TimeSeriesPoint[];
  compareEnabled?: boolean;
  label?: string;
  height?: number;
}

interface PieChartProps {
  type: "pie";
  data: Array<{ name: string; value: number }>;
  height?: number;
}

type ChartProps = AreaChartProps | BarChartProps | LineChartProps | PieChartProps;

const COLORS = ["#FFBC80", "#FFE29A", "#FFD6A5", "#F5A56A", "#FAECD6", "#E8955A"];

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatValue(value: number, prefix = "", suffix = "") {
  if (value >= 1000000) return `${prefix}${(value / 1000000).toFixed(1)}M${suffix}`;
  if (value >= 1000) return `${prefix}${(value / 1000).toFixed(1)}k${suffix}`;
  return `${prefix}${value.toFixed(value < 10 ? 2 : 0)}${suffix}`;
}

export default function MonarchChart(props: ChartProps) {
  const height = props.height ?? 240;

  if (props.type === "area") {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={props.data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="gradArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#FFBC80" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#FFBC80" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gradCompare" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#FFE29A" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#FFE29A" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(58,58,58,0.06)" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={formatDate}
            tick={{ fontSize: 11, fill: "rgba(58,58,58,0.45)" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={(v) => formatValue(v, props.valuePrefix, props.valueSuffix)}
            tick={{ fontSize: 11, fill: "rgba(58,58,58,0.45)" }}
            axisLine={false}
            tickLine={false}
            width={48}
          />
          <Tooltip
            contentStyle={{
              background: "rgba(255,249,242,0.96)",
              border: "1px solid #FFBC80",
              borderRadius: "10px",
              fontSize: 12,
              boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
            }}
            labelFormatter={formatDate}
            formatter={(value: number, name: string) => [
              formatValue(value, props.valuePrefix, props.valueSuffix),
              name === "value" ? (props.label ?? "Current") : "Prior Period",
            ]}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke="#FFBC80"
            strokeWidth={2}
            fill="url(#gradArea)"
            dot={false}
            activeDot={{ r: 4, fill: "#FFBC80", strokeWidth: 0 }}
          />
          {props.compareEnabled && (
            <Area
              type="monotone"
              dataKey="compareValue"
              stroke="#FFE29A"
              strokeWidth={1.5}
              strokeDasharray="4 3"
              fill="url(#gradCompare)"
              dot={false}
              activeDot={{ r: 3, fill: "#FFE29A", strokeWidth: 0 }}
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  if (props.type === "bar") {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={props.data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }} barGap={4}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(58,58,58,0.06)" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "rgba(58,58,58,0.45)" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "rgba(58,58,58,0.45)" }}
            axisLine={false}
            tickLine={false}
            width={48}
          />
          <Tooltip
            contentStyle={{
              background: "rgba(255,249,242,0.96)",
              border: "1px solid #FFBC80",
              borderRadius: "10px",
              fontSize: 12,
            }}
          />
          <Bar dataKey="value" fill="#FFBC80" radius={[4, 4, 0, 0]} />
          {props.data[0]?.value2 !== undefined && (
            <Bar dataKey="value2" fill="#FFE29A" radius={[4, 4, 0, 0]} />
          )}
        </BarChart>
      </ResponsiveContainer>
    );
  }

  if (props.type === "line") {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={props.data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(58,58,58,0.06)" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={formatDate}
            tick={{ fontSize: 11, fill: "rgba(58,58,58,0.45)" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "rgba(58,58,58,0.45)" }}
            axisLine={false}
            tickLine={false}
            width={48}
          />
          <Tooltip
            contentStyle={{
              background: "rgba(255,249,242,0.96)",
              border: "1px solid #FFBC80",
              borderRadius: "10px",
              fontSize: 12,
            }}
            labelFormatter={formatDate}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="#FFBC80"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: "#FFBC80", strokeWidth: 0 }}
          />
          {props.compareEnabled && (
            <Line
              type="monotone"
              dataKey="compareValue"
              stroke="#FFE29A"
              strokeWidth={1.5}
              strokeDasharray="4 3"
              dot={false}
              activeDot={{ r: 3, fill: "#FFE29A", strokeWidth: 0 }}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    );
  }

  if (props.type === "pie") {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={props.data}
            cx="50%"
            cy="50%"
            innerRadius={height * 0.28}
            outerRadius={height * 0.42}
            paddingAngle={2}
            dataKey="value"
          >
            {props.data.map((_, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              background: "rgba(255,249,242,0.96)",
              border: "1px solid #FFBC80",
              borderRadius: "10px",
              fontSize: 12,
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  return null;
}
