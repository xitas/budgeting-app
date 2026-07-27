import { Types } from "mongoose";
import { Transaction } from "../models/Transaction";
import { currentMonthYear } from "../utils/date";

export interface DashboardSummary {
  income: number; // non-loan income only
  expense: number; // non-loan expense only
  netLending: number; // loan income − loan expense this month (can be negative)
  net: number; // income − expense + netLending (== true total income − total expense)
}

export interface CategorySpending {
  categoryId: string;
  name: string;
  color: string;
  amount: number;
}

export interface MonthlyTrendPoint {
  month: string; // "2026-01"
  income: number;
  expense: number;
}

// UTC, not the local-time Date constructor: getIncomeVsExpenseTrend below
// groups by MongoDB's $year/$month operators, which extract in UTC — if the
// range boundaries were built in local time, a transaction dated the 1st of
// a month could land in the wrong UTC month on any machine with a non-zero
// timezone offset (e.g. local midnight July 1st at UTC+5 is still June 30th
// in UTC). Building both the boundaries and the grouping in UTC keeps them
// in agreement regardless of the server's local timezone.
function monthRange(month: number, year: number): { start: Date; end: Date } {
  return { start: new Date(Date.UTC(year, month - 1, 1)), end: new Date(Date.UTC(year, month, 1)) };
}

export function resolveMonthYear(month?: number, year?: number): { month: number; year: number } {
  return month && year ? { month, year } : currentMonthYear();
}

// A single $facet computes all four totals in one round trip. Loan cash
// flow is split out of income/expense (those are *behavior* numbers, same
// as the spending-by-category and trend charts below, and must agree with
// them) into its own netLending figure — only `net` needs the full picture:
// Income − Expense + Net lending = Net, and that arithmetic must visibly
// close for anyone reading the dashboard.
export async function getSummary(userId: string, month: number, year: number): Promise<DashboardSummary> {
  const { start, end } = monthRange(month, year);

  const [result] = await Transaction.aggregate<{
    income: { total: number }[];
    expense: { total: number }[];
    loanIncome: { total: number }[];
    loanExpense: { total: number }[];
  }>([
    { $match: { user: new Types.ObjectId(userId), date: { $gte: start, $lt: end } } },
    {
      $facet: {
        income: [
          { $match: { type: "income", source: { $ne: "loan" } } },
          { $group: { _id: null, total: { $sum: "$amount" } } },
        ],
        expense: [
          { $match: { type: "expense", source: { $ne: "loan" } } },
          { $group: { _id: null, total: { $sum: "$amount" } } },
        ],
        loanIncome: [{ $match: { type: "income", source: "loan" } }, { $group: { _id: null, total: { $sum: "$amount" } } }],
        loanExpense: [{ $match: { type: "expense", source: "loan" } }, { $group: { _id: null, total: { $sum: "$amount" } } }],
      },
    },
  ]);

  const income = result?.income[0]?.total ?? 0;
  const expense = result?.expense[0]?.total ?? 0;
  const loanIncome = result?.loanIncome[0]?.total ?? 0;
  const loanExpense = result?.loanExpense[0]?.total ?? 0;
  const netLending = loanIncome - loanExpense;
  return { income, expense, netLending, net: income - expense + netLending };
}

const SPENDING_TOP_N = 7;
const OTHER_BUCKET_COLOR = "#898781"; // muted/de-emphasis ink from the chart palette

export async function getSpendingByCategory(userId: string, month: number, year: number): Promise<CategorySpending[]> {
  const { start, end } = monthRange(month, year);

  const results = await Transaction.aggregate<{
    _id: Types.ObjectId;
    amount: number;
    category: { name: string; color: string }[];
  }>([
    // Loans are asset transfers, not spending behavior — excluded here (and
    // from the trend below) so a single large loan doesn't dominate the
    // category breakdown or misrepresent discretionary spending.
    { $match: { user: new Types.ObjectId(userId), type: "expense", source: { $ne: "loan" }, date: { $gte: start, $lt: end } } },
    { $group: { _id: "$category", amount: { $sum: "$amount" } } },
    { $sort: { amount: -1 } },
    { $lookup: { from: "categories", localField: "_id", foreignField: "_id", as: "category" } },
  ]);

  const rows = results
    .filter((r) => r.category.length > 0)
    .map((r) => ({
      categoryId: r._id.toString(),
      name: r.category[0].name,
      color: r.category[0].color,
      amount: r.amount,
    }));

  // The categorical palette caps at 8 usable slots for identity — beyond
  // that, fold the tail into "Other" rather than seat a hue nobody can
  // distinguish from an existing one.
  if (rows.length <= SPENDING_TOP_N) {
    return rows;
  }
  const top = rows.slice(0, SPENDING_TOP_N);
  const otherTotal = rows.slice(SPENDING_TOP_N).reduce((sum, r) => sum + r.amount, 0);
  return [...top, { categoryId: "other", name: "Other", color: OTHER_BUCKET_COLOR, amount: otherTotal }];
}

export async function getIncomeVsExpenseTrend(
  userId: string,
  month: number,
  year: number,
  monthsBack: number
): Promise<MonthlyTrendPoint[]> {
  const end = new Date(Date.UTC(year, month, 1));
  const start = new Date(Date.UTC(year, month - monthsBack, 1));

  const results = await Transaction.aggregate<{
    _id: { year: number; month: number; type: "income" | "expense" };
    total: number;
  }>([
    { $match: { user: new Types.ObjectId(userId), source: { $ne: "loan" }, date: { $gte: start, $lt: end } } },
    {
      $group: {
        _id: { year: { $year: "$date" }, month: { $month: "$date" }, type: "$type" },
        total: { $sum: "$amount" },
      },
    },
  ]);

  // Zero-fill every month in the window up front so a month with no
  // transactions shows as 0, not as a gap.
  const points: MonthlyTrendPoint[] = [];
  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(year, month - 1 - i, 1));
    points.push({ month: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`, income: 0, expense: 0 });
  }
  const indexByKey = new Map(points.map((p, idx) => [p.month, idx]));

  for (const r of results) {
    const key = `${r._id.year}-${String(r._id.month).padStart(2, "0")}`;
    const idx = indexByKey.get(key);
    if (idx === undefined) continue;
    if (r._id.type === "income") {
      points[idx].income = r.total;
    } else {
      points[idx].expense = r.total;
    }
  }

  return points;
}
