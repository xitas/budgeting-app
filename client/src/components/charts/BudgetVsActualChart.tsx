import { Bar, BarChart, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { centsToUnits, formatMoney, type BudgetVsActual } from "shared";
import { ChartCard } from "./ChartCard";
import { ChartTooltip } from "./ChartTooltip";
import { useChartTheme } from "./chartTheme";


interface Row {
  name: string;
  color: string;
  percent: number;
  spentCents: number;
  limitCents: number;
}

export function BudgetVsActualChart({ data }: { data: BudgetVsActual[] }) {
  const theme = useChartTheme();
  if (data.length === 0) {
    return (
      <ChartCard title="Budget vs actual">
        <p className="py-6 text-center text-sm text-slate-500">No budgets set for this month.</p>
      </ChartCard>
    );
  }

  const chartData: Row[] = data.map((b) => ({
    name: b.category.name,
    color: theme.color(b.category.color),
    percent: b.limitCents > 0 ? Math.round((b.spentCents / b.limitCents) * 100) : 0,
    spentCents: b.spentCents,
    limitCents: b.limitCents,
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
            <td className="py-1.5 text-right">{formatMoney(row.spentCents)}</td>
            <td className="py-1.5 text-right">{formatMoney(row.limitCents)}</td>
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
            tick={{ fontSize: 12, fill: theme.axis }}
            axisLine={{ stroke: theme.grid }}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={90}
            tick={{ fontSize: 12, fill: theme.axis }}
            axisLine={{ stroke: theme.grid }}
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
                  payload={[{ value: centsToUnits(row.spentCents), name: `Spent of ${formatMoney(row.limitCents)} limit`, color: row.color }]}
                />
              );
            }}
            cursor={{ fill: theme.cursor }}
          />
          <ReferenceLine x={100} stroke={theme.axis} />
          <Bar dataKey="percent" name="% of budget" barSize={18} radius={[0, 4, 4, 0]}>
            {chartData.map((row) => (
              <Cell key={row.name} fill={row.percent > 100 ? theme.overBudget : row.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
