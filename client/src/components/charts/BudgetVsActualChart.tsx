import { Bar, BarChart, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { BudgetVsActual } from "../../features/dashboard/types";
import { ChartCard } from "./ChartCard";
import { ChartTooltip } from "./ChartTooltip";

const GRID_COLOR = "#e1e0d9";
const AXIS_COLOR = "#898781";
const OVER_BUDGET_COLOR = "#e34948";

interface Row {
  name: string;
  color: string;
  percent: number;
  spent: number;
  limit: number;
}

export function BudgetVsActualChart({ data }: { data: BudgetVsActual[] }) {
  if (data.length === 0) {
    return (
      <ChartCard title="Budget vs actual">
        <p className="py-6 text-center text-sm text-slate-500">No budgets set for this month.</p>
      </ChartCard>
    );
  }

  const chartData: Row[] = data.map((b) => ({
    name: b.category.name,
    color: b.category.color,
    percent: b.limit > 0 ? Math.round((b.spent / b.limit) * 100) : 0,
    spent: b.spent,
    limit: b.limit,
  }));

  const tableView = (
    <table className="w-full text-left text-sm">
      <thead className="text-slate-500">
        <tr>
          <th className="py-1 font-medium">Category</th>
          <th className="py-1 text-right font-medium">Spent</th>
          <th className="py-1 text-right font-medium">Limit</th>
        </tr>
      </thead>
      <tbody>
        {chartData.map((row) => (
          <tr key={row.name} className="border-t border-slate-100">
            <td className="py-1.5">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: row.color }} />
                {row.name}
              </span>
            </td>
            <td className="py-1.5 text-right">{row.spent.toFixed(2)}</td>
            <td className="py-1.5 text-right">{row.limit.toFixed(2)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <ChartCard title="Budget vs actual (% of limit)" tableView={tableView}>
      <ResponsiveContainer width="100%" height={Math.max(160, chartData.length * 36)}>
        <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
          <XAxis
            type="number"
            unit="%"
            domain={[0, (dataMax: number) => Math.max(100, dataMax)]}
            tick={{ fontSize: 12, fill: AXIS_COLOR }}
            axisLine={{ stroke: GRID_COLOR }}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={90}
            tick={{ fontSize: 12, fill: AXIS_COLOR }}
            axisLine={{ stroke: GRID_COLOR }}
            tickLine={false}
          />
          <Tooltip
            content={({ active, label, payload }) => {
              const row = payload?.[0]?.payload as Row | undefined;
              if (!active || !row) return null;
              return (
                <ChartTooltip
                  active={active}
                  label={label}
                  payload={[{ value: row.spent, name: `Spent of ${row.limit.toFixed(2)} limit`, color: row.color }]}
                />
              );
            }}
            cursor={{ fill: "#f4f4f2" }}
          />
          <ReferenceLine x={100} stroke={AXIS_COLOR} />
          <Bar dataKey="percent" name="% of budget" barSize={18} radius={[0, 4, 4, 0]}>
            {chartData.map((row) => (
              <Cell key={row.name} fill={row.percent > 100 ? OVER_BUDGET_COLOR : row.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
