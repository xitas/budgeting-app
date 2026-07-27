import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { CategorySpending } from "../../features/dashboard/types";
import { ChartCard } from "./ChartCard";
import { ChartTooltip } from "./ChartTooltip";

const GRID_COLOR = "#e1e0d9";
const AXIS_COLOR = "#898781";

export function SpendingByCategoryChart({ data }: { data: CategorySpending[] }) {
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
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: row.color }} />
                {row.name}
              </span>
            </td>
            <td className="py-1.5 text-right">{row.amount.toFixed(2)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <ChartCard title="Spending by category" tableView={tableView}>
      <ResponsiveContainer width="100%" height={Math.max(160, data.length * 36)}>
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
          <XAxis type="number" tick={{ fontSize: 12, fill: AXIS_COLOR }} axisLine={{ stroke: GRID_COLOR }} tickLine={false} />
          <YAxis
            type="category"
            dataKey="name"
            width={90}
            tick={{ fontSize: 12, fill: AXIS_COLOR }}
            axisLine={{ stroke: GRID_COLOR }}
            tickLine={false}
          />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: "#f4f4f2" }} />
          <Bar dataKey="amount" name="Spent" barSize={18} radius={[0, 4, 4, 0]}>
            {data.map((row) => (
              <Cell key={row.categoryId} fill={row.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
