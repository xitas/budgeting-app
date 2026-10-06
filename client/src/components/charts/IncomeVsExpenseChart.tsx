import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CATEGORICAL_PALETTE, centsToUnits, formatMoney, type MonthlyTrendPoint } from "shared";
import { ChartCard } from "./ChartCard";
import { ChartTooltip } from "./ChartTooltip";
import { useChartTheme } from "./chartTheme";

// Fixed categorical order — slot 1 (blue) and slot 2 (orange), consistent
// with the rest of the app's palette usage. Never reassign per chart.
const INCOME_COLOR = CATEGORICAL_PALETTE[0];
const EXPENSE_COLOR = CATEGORICAL_PALETTE[1];

function monthLabel(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

export function IncomeVsExpenseChart({ data }: { data: MonthlyTrendPoint[] }) {
  const theme = useChartTheme();
  const chartData = data.map((d) => ({
    ...d,
    label: monthLabel(d.month),
    income: centsToUnits(d.incomeCents), // plotted in currency units
    expense: centsToUnits(d.expenseCents),
  }));

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
            <td className="py-1.5 text-right">{formatMoney(row.incomeCents)}</td>
            <td className="py-1.5 text-right">{formatMoney(row.expenseCents)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <ChartCard title="Income vs expense" tableView={tableView}>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={chartData} margin={{ left: 0, right: 8, top: 4, bottom: 4 }}>
          <CartesianGrid vertical={false} stroke={theme.grid} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 12, fill: theme.axis }}
            axisLine={{ stroke: theme.grid }}
            tickLine={false}
          />
          <YAxis tick={{ fontSize: 12, fill: theme.axis }} axisLine={false} tickLine={false} />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: theme.cursor }} />
          {/* Legend text in ink, not the series color — the dot carries identity. */}
          <Legend
            wrapperStyle={{ fontSize: 12 }}
            iconType="circle"
            iconSize={8}
            formatter={(value: string) => <span className="text-slate-600">{value}</span>}
          />
          <Bar dataKey="income" name="Income" fill={theme.color(INCOME_COLOR)} barSize={16} radius={[4, 4, 0, 0]} />
          <Bar dataKey="expense" name="Expense" fill={theme.color(EXPENSE_COLOR)} barSize={16} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
