import { useQuery } from "@tanstack/react-query";
import type { HealthResponse } from "shared";
import { apiClient } from "./lib/apiClient";

function App() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["health"],
    queryFn: async () => {
      const res = await apiClient.get<HealthResponse>("/health");
      return res.data;
    },
  });

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="rounded-lg border border-slate-200 bg-white p-8 shadow-sm text-center">
        <h1 className="text-2xl font-semibold text-slate-900">Budget App</h1>
        <p className="mt-2 text-slate-600">
          {isLoading && "Checking API connection..."}
          {isError && "Could not reach the API."}
          {data && `API is ${data.status} (uptime ${Math.round(data.uptime)}s)`}
        </p>
      </div>
    </div>
  );
}

export default App;
