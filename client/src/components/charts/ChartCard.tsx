import { useState, type ReactNode } from "react";

interface ChartCardProps {
  title: string;
  children: ReactNode;
  tableView?: ReactNode;
}

// The chart container foundation: title + the accessibility twin every chart
// needs (a plain table view), never a fixed height that clips the axis band.
export function ChartCard({ title, children, tableView }: ChartCardProps) {
  const [showTable, setShowTable] = useState(false);

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-medium text-slate-700">{title}</h2>
        {tableView && (
          <button
            type="button"
            onClick={() => setShowTable((prev) => !prev)}
            className="text-xs text-slate-400 transition-colors hover:text-blue-600"
          >
            {showTable ? "View chart" : "View as table"}
          </button>
        )}
      </div>
      {showTable && tableView ? tableView : children}
    </div>
  );
}
