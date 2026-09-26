import { useQuery } from "@tanstack/react-query";
import type { DashboardSummary } from "shared";
import { apiClient } from "../../lib/apiClient";

export async function getSummary(month: number, year: number): Promise<DashboardSummary> {
  const res = await apiClient.get<DashboardSummary>("/dashboard/summary", { params: { month, year } });
  return res.data;
}

export function useSummary(month: number, year: number) {
  return useQuery({ queryKey: ["dashboard", "summary", year, month], queryFn: () => getSummary(month, year) });
}
