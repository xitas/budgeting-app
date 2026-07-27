import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { NavBar } from "./NavBar";

export function ProtectedLayout() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div className="flex min-h-screen items-center justify-center text-slate-500">Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <NavBar />
      <Outlet />
    </div>
  );
}
