import { useAuth } from "../context/AuthContext";

export function DashboardPage() {
  const { user } = useAuth();

  return (
    <div className="mx-auto max-w-2xl p-8">
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">Welcome, {user?.name}</h1>
        <p className="mt-1 text-sm text-slate-500">{user?.email}</p>
        <p className="mt-6 text-sm text-slate-500">Budgets and charts land here in upcoming milestones.</p>
      </div>
    </div>
  );
}
