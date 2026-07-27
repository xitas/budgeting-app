import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CATEGORICAL_PALETTE } from "shared";
import type { MonthlyTrendPoint } from "../../features/dashboard/types";
import { ChartCard } from "./ChartCard";
import { ChartTooltip } from "./ChartTooltip";

const GRID_COLOR = "#e1e0d9";
const AXIS_COLOR = "#898781";
// Fixed categorical order — slot 1 (blue) and slot 2 (orange), consistent
// with the rest of the app's palette usage. Never reassign per chart.
const INCOME_COLOR = CATEGORICAL_PALETTE[0];
const EXPENSE_COLOR = CATEGORICAL_PALETTE[1];

function monthLabel(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

export function IncomeVsExpenseChart({ data }: { data: MonthlyTrendPoint[] }) {
  const chartData = data.map((d) => ({ ...d, label: monthLabel(d.month) }));

  const tableView = (
    <table className="w-full text-left text-sm">
      <thead className="text-slate-500">
        <tr>
          <th className="py-1 font-medium">Month</th>
          <th className="py-1 text-right font-medium">Income</th>
          <th className="py-1 text-right font-medium">Expense</th>
        </tr>
      </thead>
      <tbody>
        {chartData.map((row) => (
          <tr key={row.month} className="border-t border-slate-100">
            <td className="py-1.5">{row.label}</td>
            <td className="py-1.5 text-right">{row.income.toFixed(2)}</td>
            <td className="py-1.5 text-right">{row.expense.toFixed(2)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <ChartCard title="Income vs expense" tableView={tableView}>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={chartData} margin={{ left: 0, right: 8, top: 4, bottom: 4 }}>
          <CartesianGrid vertical={false} stroke={GRID_COLOR} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 12, fill: AXIS_COLOR }}
            axisLine={{ stroke: GRID_COLOR }}
            tickLine={false}
          />
          <YAxis tick={{ fontSize: 12, fill: AXIS_COLOR }} axisLine={false} tickLine={false} />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: "#f4f4f2" }} />
          <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" iconSize={8} />
          <Bar dataKey="income" name="Income" fill={INCOME_COLOR} barSize={16} radius={[4, 4, 0, 0]} />
          <Bar dataKey="expense" name="Expense" fill={EXPENSE_COLOR} barSize={16} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
