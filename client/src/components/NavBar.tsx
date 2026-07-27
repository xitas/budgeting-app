import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function linkClass({ isActive }: { isActive: boolean }): string {
  return `rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
    isActive ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-100"
  }`;
}

export function NavBar() {
  const { user, logout } = useAuth();

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-8">
        <nav className="flex gap-2">
          <NavLink to="/" end className={linkClass}>
            Dashboard
          </NavLink>
          <NavLink to="/transactions" className={linkClass}>
            Transactions
          </NavLink>
        </nav>
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-slate-500 sm:inline">{user?.email}</span>
          <button
            type="button"
            onClick={() => void logout()}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 transition-colors hover:bg-slate-100"
          >
            Log out
          </button>
        </div>
      </div>
    </header>
  );
}
