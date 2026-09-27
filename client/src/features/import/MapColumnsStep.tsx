import { buttonClass, ghostButtonClass, inputClass } from "../../components/ui/formStyles";
import { formatDisplayDate } from "../../lib/formatDate";
import {
  DATE_FORMATS,
  buildRows,
  type ColumnMapping,
  type DateFormat,
  type DecimalSeparator,
  type ParseOptions,
} from "./parse";

interface MapColumnsStepProps {
  fileName: string;
  headers: string[];
  dataRows: string[][];
  mapping: ColumnMapping;
  onMappingChange: (mapping: ColumnMapping) => void;
  options: ParseOptions;
  onOptionsChange: (options: ParseOptions) => void;
  dateAmbiguous: boolean;
  onBack: () => void;
  onContinue: () => void;
  isChecking: boolean;
  error: string | null;
}

const PREVIEW_ROWS = 5;

export function MapColumnsStep({
  fileName,
  headers,
  dataRows,
  mapping,
  onMappingChange,
  options,
  onOptionsChange,
  dateAmbiguous,
  onBack,
  onContinue,
  isChecking,
  error,
}: MapColumnsStepProps) {
  const set = (patch: Partial<ColumnMapping>) => onMappingChange({ ...mapping, ...patch });
  const preview = buildRows(dataRows.slice(0, PREVIEW_ROWS), mapping, options);
  const amountMapped = mapping.amountMode === "signed" ? mapping.amount >= 0 : mapping.debit >= 0 || mapping.credit >= 0;
  const canContinue = mapping.date >= 0 && amountMapped;

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-600">
        <span className="font-medium text-slate-900">{fileName}</span> · {dataRows.length} rows. Check which column holds
        what — the preview below updates as you go.
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <ColumnSelect label="Date" headers={headers} value={mapping.date} onChange={(date) => set({ date })} />
        <ColumnSelect
          label="Description"
          headers={headers}
          value={mapping.description}
          onChange={(description) => set({ description })}
          optional
        />

        <fieldset className="sm:col-span-2">
          <legend className="mb-1 text-sm font-medium text-slate-700">Amount</legend>
          <div className="mb-2 flex flex-wrap gap-4 text-sm text-slate-700">
            <label className="inline-flex items-center gap-2">
              <input
                type="radio"
                checked={mapping.amountMode === "signed"}
                onChange={() => set({ amountMode: "signed" })}
              />
              One amount column (negative = money out)
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="radio"
                checked={mapping.amountMode === "debitCredit"}
                onChange={() => set({ amountMode: "debitCredit" })}
              />
              Separate money out / money in columns
            </label>
          </div>
          {mapping.amountMode === "signed" ? (
            <ColumnSelect label="Amount column" headers={headers} value={mapping.amount} onChange={(amount) => set({ amount })} />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <ColumnSelect label="Money out (debit)" headers={headers} value={mapping.debit} onChange={(debit) => set({ debit })} optional />
              <ColumnSelect label="Money in (credit)" headers={headers} value={mapping.credit} onChange={(credit) => set({ credit })} optional />
            </div>
          )}
        </fieldset>

        <ColumnSelect
          label="Type column (income / expense)"
          headers={headers}
          value={mapping.type}
          onChange={(type) => set({ type })}
          optional
          hint="Only if the file has one — otherwise the amount's sign decides."
        />
        <ColumnSelect
          label="Category column"
          headers={headers}
          value={mapping.category}
          onChange={(category) => set({ category })}
          optional
          hint="Matched to your categories by name."
        />

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Date format</span>
          <select
            className={inputClass}
            value={options.dateFormat}
            onChange={(e) => onOptionsChange({ ...options, dateFormat: e.target.value as DateFormat })}
          >
            {DATE_FORMATS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
          {dateAmbiguous && (
            <span className="mt-1 block text-xs text-slate-500">
              Every day in this file is 12 or less, so day-first and month-first both fit — check the preview dates.
            </span>
          )}
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Decimal separator</span>
          <select
            className={inputClass}
            value={options.decimal}
            onChange={(e) => onOptionsChange({ ...options, decimal: e.target.value as DecimalSeparator })}
          >
            <option value=".">Dot — 1,234.56</option>
            <option value=",">Comma — 1.234,56</option>
          </select>
        </label>

        <label className="inline-flex items-center gap-2 text-sm text-slate-700 sm:col-span-2">
          <input
            type="checkbox"
            checked={options.invertSigns}
            onChange={(e) => onOptionsChange({ ...options, invertSigns: e.target.checked })}
          />
          Flip signs (my bank lists spending as positive numbers)
        </label>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-medium text-slate-700">Preview (first {Math.min(PREVIEW_ROWS, dataRows.length)} rows)</h2>
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-surface">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-slate-500">
              <tr>
                <th className="px-3 py-2 font-medium">Date</th>
                <th className="px-3 py-2 font-medium">Description</th>
                <th className="px-3 py-2 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {preview.map((row) => (
                <tr key={row.line} className="border-b border-slate-100 last:border-b-0">
                  {row.error ? (
                    <td colSpan={3} className="px-3 py-2 text-red-600">
                      Line {row.line}: {row.error}
                    </td>
                  ) : (
                    <>
                      <td className="px-3 py-2 text-slate-600">{formatDisplayDate(row.date!)}</td>
                      <td className="px-3 py-2">{row.description || "—"}</td>
                      <td className={`px-3 py-2 text-right ${row.type === "income" ? "text-green-700" : "text-slate-900"}`}>
                        {row.type === "income" ? "+" : "-"}
                        {row.amount!.toFixed(2)}
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex justify-between gap-3">
        <button type="button" onClick={onBack} className={ghostButtonClass}>
          Choose another file
        </button>
        <button type="button" onClick={onContinue} disabled={!canContinue || isChecking} className={buttonClass}>
          {isChecking ? "Checking for duplicates..." : "Continue to review"}
        </button>
      </div>
    </div>
  );
}

interface ColumnSelectProps {
  label: string;
  headers: string[];
  value: number;
  onChange: (index: number) => void;
  optional?: boolean;
  hint?: string;
}

function ColumnSelect({ label, headers, value, onChange, optional, hint }: ColumnSelectProps) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-slate-700">{label}</span>
      <select className={inputClass} value={value} onChange={(e) => onChange(Number(e.target.value))}>
        <option value={-1}>{optional ? "— none —" : "Choose a column"}</option>
        {headers.map((h, i) => (
          <option key={i} value={i}>
            {h.trim() || `Column ${i + 1}`}
          </option>
        ))}
      </select>
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}
