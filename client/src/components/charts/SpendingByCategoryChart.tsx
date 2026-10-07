import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { centsToUnits, type CategorySpending } from "shared";
import { ChartCard } from "./ChartCard";
import { ChartTooltip } from "./ChartTooltip";
import { useChartTheme } from "./chartTheme";
import { useMoney } from "../../lib/useMoney";


export function SpendingByCategoryChart({ data }: { data: CategorySpending[] }) {
  const money = useMoney();
  const theme = useChartTheme();
  if (data.length === 0) {
    return (
      <ChartCard title="Spending by category">
        <p className="py-6 text-center text-sm text-slate-500">No expenses recorded for this month.</p>
      </ChartCard>
    );
  }

  const tableView = (
    <table className="w-full text-left text-sm">
      <thead className="text-slate-500">
        <tr>
          <th className="py-1 font-medium">Category</th>
          <th className="py-1 text-right font-medium">Amount</th>
        </tr>
      </thead>
      <tbody>
        {data.map((row) => (
          <tr key={row.categoryId} className="border-t border-slate-100">
            <td className="py-1.5">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: theme.color(row.color) }} />
                {row.name}
              </span>
            </td>
            <td className="py-1.5 text-right">{money.format(row.amountCents)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <ChartCard title="Spending by category" tableView={tableView}>
      <ResponsiveContainer width="100%" height={Math.max(160, data.length * 36)}>
        <BarChart data={data.map((row) => ({ ...row, amount: centsToUnits(row.amountCents) }))} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
          <XAxis type="number" tick={{ fontSize: 12, fill: theme.axis }} axisLine={{ stroke: theme.grid }} tickLine={false} />
          <YAxis
            type="category"
            dataKey="name"
            width={90}
            tick={{ fontSize: 12, fill: theme.axis }}
            axisLine={{ stroke: theme.grid }}
            tickLine={false}
          />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: theme.cursor }} />
          <Bar dataKey="amount" name="Spent" barSize={18} radius={[0, 4, 4, 0]}>
            {data.map((row) => (
              <Cell key={row.categoryId} fill={theme.color(row.color)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
