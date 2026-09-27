import type { Category, TransactionType } from "shared";
import { buttonClass, ghostButtonClass, inputClass } from "../../components/ui/formStyles";
import { useSchemeColor } from "../../context/ThemeContext";
import { formatDisplayDate } from "../../lib/formatDate";
import { effectiveCategory, type ReviewRow } from "./review";

interface ReviewStepProps {
  rows: ReviewRow[];
  onRowsChange: (rows: ReviewRow[]) => void;
  categories: Category[];
  fallback: Record<TransactionType, string>;
  onFallbackChange: (fallback: Record<TransactionType, string>) => void;
  onBack: () => void;
  onImport: () => void;
  isImporting: boolean;
  error: string | null;
}

export function ReviewStep({
  rows,
  onRowsChange,
  categories,
  fallback,
  onFallbackChange,
  onBack,
  onImport,
  isImporting,
  error,
}: ReviewStepProps) {
  const schemeColor = useSchemeColor();
  const byType = (type: TransactionType) => categories.filter((c) => c.type === type);
  const selected = rows.filter((r) => r.include);
  const missingCategory = selected.filter((r) => !effectiveCategory(r, fallback));
  const duplicates = rows.filter((r) => r.duplicate).length;
  const invalid = rows.filter((r) => r.error).length;
  const needsFallback = (type: TransactionType) => selected.some((r) => r.type === type && !r.categoryId);

  function update(index: number, patch: Partial<ReviewRow>): void {
    onRowsChange(rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function setAll(include: boolean): void {
    onRowsChange(rows.map((r) => (r.error ? r : { ...r, include })));
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-600">
        <span>
          <span className="font-semibold text-slate-900">{selected.length}</span> selected to import
        </span>
        {duplicates > 0 && <span>{duplicates} look like transactions you already have (unticked)</span>}
        {invalid > 0 && <span className="text-red-600">{invalid} can't be read (skipped)</span>}
      </div>

      <div className="grid grid-cols-1 gap-4 rounded-lg border border-slate-200 bg-surface p-4 sm:grid-cols-2">
        <p className="text-sm text-slate-600 sm:col-span-2">
          Rows without a matching category get these (you can still change any single row below):
        </p>
        {(["expense", "income"] as const).map((type) => (
          <label key={type} className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">
              Unmatched {type === "expense" ? "expenses" : "income"}
              {needsFallback(type) && !fallback[type] && <span className="text-red-600"> — required</span>}
            </span>
            <select
              className={inputClass}
              value={fallback[type]}
              onChange={(e) => onFallbackChange({ ...fallback, [type]: e.target.value })}
            >
              <option value="">Choose a category</option>
              {byType(type).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>

      <div className="max-h-[32rem] overflow-auto rounded-lg border border-slate-200 bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 border-b border-slate-200 bg-surface text-slate-500">
            <tr>
              <th className="px-3 py-2">
                <input
                  type="checkbox"
                  aria-label="Select all"
                  checked={selected.length > 0 && selected.length === rows.filter((r) => !r.error).length}
                  onChange={(e) => setAll(e.target.checked)}
                />
              </th>
              <th className="px-3 py-2 font-medium">Date</th>
              <th className="px-3 py-2 font-medium">Description</th>
              <th className="px-3 py-2 text-right font-medium">Amount</th>
              <th className="px-3 py-2 font-medium">Category</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              if (row.error) {
                return (
                  <tr key={row.line} className="border-b border-slate-100 bg-red-50 last:border-b-0">
                    <td className="px-3 py-2" />
                    <td colSpan={4} className="px-3 py-2 text-red-600">
                      Line {row.line}: {row.error}
                    </td>
                  </tr>
                );
              }
              const type = row.type!;
              const categoryId = effectiveCategory(row, fallback);
              const category = categories.find((c) => c.id === categoryId);
              return (
                <tr key={row.line} className={`border-b border-slate-100 last:border-b-0 ${row.include ? "" : "opacity-50"}`}>
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      aria-label={`Import line ${row.line}`}
                      checked={row.include}
                      onChange={(e) => update(i, { include: e.target.checked })}
                    />
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-slate-600">{formatDisplayDate(row.date!)}</td>
                  <td className="px-3 py-2">
                    {row.description || "—"}
                    {row.duplicate && (
                      <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">Possible duplicate</span>
                    )}
                  </td>
                  <td className={`whitespace-nowrap px-3 py-2 text-right ${type === "income" ? "text-green-700" : "text-slate-900"}`}>
                    {type === "income" ? "+" : "-"}
                    {row.amount!.toFixed(2)}
                  </td>
                  <td className="px-3 py-2">
                    <span className="inline-flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: category ? schemeColor(category.color) : "transparent" }}
                      />
                      <select
                        aria-label={`Category for line ${row.line}`}
                        className={`${inputClass} py-1`}
                        value={row.categoryId}
                        onChange={(e) => update(i, { categoryId: e.target.value })}
                      >
                        <option value="">
                          {fallback[type] ? `Unmatched → ${categories.find((c) => c.id === fallback[type])?.name}` : "Choose…"}
                        </option>
                        {byType(type).map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {missingCategory.length > 0 && (
        <p className="text-sm text-slate-600">
          {missingCategory.length} selected {missingCategory.length === 1 ? "row needs" : "rows need"} a category — pick
          one above for unmatched rows, or per row.
        </p>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex justify-between gap-3">
        <button type="button" onClick={onBack} className={ghostButtonClass}>
          Back to columns
        </button>
        <button
          type="button"
          onClick={onImport}
          disabled={selected.length === 0 || missingCategory.length > 0 || isImporting}
          className={buttonClass}
        >
          {isImporting ? "Importing..." : `Import ${selected.length} transaction${selected.length === 1 ? "" : "s"}`}
        </button>
      </div>
    </div>
  );
}
