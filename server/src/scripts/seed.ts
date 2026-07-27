import mongoose from "mongoose";
import { connectDb } from "../config/db";
import { Budget } from "../models/Budget";
import { Category, CategoryDocument } from "../models/Category";
import { Loan } from "../models/Loan";
import { RecurringTransaction } from "../models/RecurringTransaction";
import { Transaction } from "../models/Transaction";
import { User } from "../models/User";
import { seedDefaultCategories } from "../services/category.service";
import * as loanService from "../services/loan.service";
import { generateDueTransactions } from "../services/recurring.service";

const DEMO_EMAIL = "demo@example.com";
const DEMO_PASSWORD = "password123";

async function wipeExistingDemoUser(): Promise<void> {
  const existing = await User.findOne({ email: DEMO_EMAIL });
  if (!existing) {
    return;
  }
  await Promise.all([
    Transaction.deleteMany({ user: existing._id }),
    Category.deleteMany({ user: existing._id }),
    Budget.deleteMany({ user: existing._id }),
    RecurringTransaction.deleteMany({ user: existing._id }),
    Loan.deleteMany({ user: existing._id }),
  ]);
  await existing.deleteOne();
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d;
}

// Demo dates are hand-picked days across recent months, which can land after
// "today" for the current month — clamp so nothing is seeded in the future.
function clampToToday(date: Date): Date {
  const now = new Date();
  return date > now ? now : date;
}

function randomAmount(min: number, max: number): number {
  return Math.round((min + Math.random() * (max - min)) * 100) / 100;
}

async function seed(): Promise<void> {
  await connectDb();
  await wipeExistingDemoUser();

  const user = new User({ email: DEMO_EMAIL, name: "Demo User" });
  (user as unknown as { password: string }).password = DEMO_PASSWORD;
  await user.save();
  await seedDefaultCategories(user.id);

  const categories = await Category.find({ user: user._id });
  function categoryByName(name: string): CategoryDocument {
    const category = categories.find((c) => c.name === name);
    if (!category) {
      throw new Error(`Missing seeded category: ${name}`);
    }
    return category;
  }

  // Salary and Rent come from recurring rules with ~3 months of history, so
  // the demo also shows off the recurring feature, not just plain CRUD data.
  const salaryRecurring = await RecurringTransaction.create({
    user: user._id,
    category: categoryByName("Salary")._id,
    amount: 3200,
    type: "income",
    description: "Monthly salary",
    frequency: "monthly",
    interval: 1,
    startDate: daysAgo(95),
    isActive: true,
  });
  const rentRecurring = await RecurringTransaction.create({
    user: user._id,
    category: categoryByName("Rent")._id,
    amount: 1200,
    type: "expense",
    description: "Rent",
    frequency: "monthly",
    interval: 1,
    startDate: daysAgo(95),
    isActive: true,
  });
  await generateDueTransactions(salaryRecurring, new Date());
  await generateDueTransactions(rentRecurring, new Date());

  // One-off manual transactions across the past 3 months for variety.
  const manualRows: Array<{
    user: typeof user._id;
    category: mongoose.Types.ObjectId;
    amount: number;
    type: "income" | "expense";
    description: string;
    date: Date;
    source: "manual";
  }> = [];

  for (let monthsBack = 2; monthsBack >= 0; monthsBack--) {
    const base = new Date();
    base.setDate(1);
    base.setMonth(base.getMonth() - monthsBack);
    const y = base.getFullYear();
    const m = base.getMonth();
    const mkDate = (day: number) => clampToToday(new Date(y, m, day));

    manualRows.push(
      {
        user: user._id,
        category: categoryByName("Utilities")._id,
        amount: randomAmount(80, 130),
        type: "expense",
        description: "Electricity & water",
        date: mkDate(3),
        source: "manual",
      },
      {
        user: user._id,
        category: categoryByName("Dining Out")._id,
        amount: randomAmount(20, 45),
        type: "expense",
        description: "Dinner out",
        date: mkDate(10),
        source: "manual",
      },
      {
        user: user._id,
        category: categoryByName("Dining Out")._id,
        amount: randomAmount(10, 25),
        type: "expense",
        description: "Lunch",
        date: mkDate(22),
        source: "manual",
      },
      {
        user: user._id,
        category: categoryByName("Entertainment")._id,
        amount: randomAmount(10, 20),
        type: "expense",
        description: "Streaming subscription",
        date: mkDate(12),
        source: "manual",
      },
      {
        user: user._id,
        category: categoryByName("Transportation")._id,
        amount: randomAmount(40, 70),
        type: "expense",
        description: "Gas",
        date: mkDate(8),
        source: "manual",
      },
      {
        user: user._id,
        category: categoryByName("Freelance")._id,
        amount: randomAmount(150, 400),
        type: "income",
        description: "Side project",
        date: mkDate(18),
        source: "manual",
      }
    );

    for (let week = 0; week < 4; week++) {
      manualRows.push({
        user: user._id,
        category: categoryByName("Groceries")._id,
        amount: randomAmount(35, 90),
        type: "expense",
        description: "Groceries",
        date: mkDate(3 + week * 7),
        source: "manual",
      });
    }
  }

  await Transaction.insertMany(manualRows);

  const now = new Date();
  await Budget.insertMany([
    { user: user._id, category: categoryByName("Groceries")._id, limit: 250, month: now.getMonth() + 1, year: now.getFullYear() },
    { user: user._id, category: categoryByName("Dining Out")._id, limit: 100, month: now.getMonth() + 1, year: now.getFullYear() },
    { user: user._id, category: categoryByName("Entertainment")._id, limit: 50, month: now.getMonth() + 1, year: now.getFullYear() },
    { user: user._id, category: categoryByName("Transportation")._id, limit: 150, month: now.getMonth() + 1, year: now.getFullYear() },
  ]);

  // A couple of loans, showcasing both directions and a partial repayment.
  const lentLoan = await loanService.createLoan(user.id, {
    counterparty: "Jordan",
    direction: "lent",
    principal: 400,
    description: "Covered concert tickets",
    date: daysAgo(20),
  });
  await loanService.addRepayment(user.id, lentLoan.id, { amount: 150, date: daysAgo(5) });

  await loanService.createLoan(user.id, {
    counterparty: "Morgan",
    direction: "borrowed",
    principal: 250,
    description: "Car repair help",
    date: daysAgo(10),
  });

  console.log(`Seeded demo user -> email: ${DEMO_EMAIL}  password: ${DEMO_PASSWORD}`);
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
