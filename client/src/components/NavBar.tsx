import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function linkClass({ isActive }: { isActive: boolean }): string {
  return `rounded-md px-3 py-1.5 text-sm font-medium ${
    isActive ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-100"
  }`;
}

export function NavBar() {
  const { user, logout } = useAuth();

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
        <nav className="flex gap-2">
          <NavLink to="/" end className={linkClass}>
            Dashboard
          </NavLink>
          <NavLink to="/transactions" className={linkClass}>
            Transactions
          </NavLink>
          <NavLink to="/budgets" className={linkClass}>
            Budgets
          </NavLink>
          <NavLink to="/categories" className={linkClass}>
            Categories
          </NavLink>
        </nav>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-500">{user?.email}</span>
          <button
            type="button"
            onClick={() => void logout()}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
          >
            Log out
          </button>
        </div>
      </div>
    </header>
  );
}
