import type { QueryClient } from "@tanstack/react-query";

// Tab screens stay mounted on mobile (unlike web pages, which refetch on
// navigation), so anything that creates, changes or removes a real
// Transaction must refresh every view derived from transactions: the list,
// the dashboard figures and budget spend.
export function invalidateMoneyViews(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: ["transactions"] });
  void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  void queryClient.invalidateQueries({ queryKey: ["budgets"] });
}
