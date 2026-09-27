import { useQueryClient } from "@tanstack/react-query";
import { useState, type ChangeEvent } from "react";
import { Link } from "react-router-dom";
import type { TransactionType } from "shared";
import { buttonClass } from "../components/ui/formStyles";
import { useCategories } from "../features/categories/hooks";
import { MapColumnsStep } from "../features/import/MapColumnsStep";
import {
  buildRows,
  detectDateFormat,
  detectDecimalSeparator,
  guessMapping,
  parseCsv,
  type ColumnMapping,
  type ParseOptions,
} from "../features/import/parse";
import { effectiveCategory, type ReviewRow } from "../features/import/review";
import { ReviewStep } from "../features/import/ReviewStep";
import { checkImportDuplicates, importTransactions } from "../features/transactions/api";
import { extractErrorMessage } from "../lib/errors";

// Server-side cap per request (MAX_IMPORT_ROWS); larger files must be split.
const MAX_ROWS = 5000;

type Step = "file" | "map" | "review" | "done";

interface LoadedFile {
  name: string;
  headers: string[];
  dataRows: string[][];
}

export function ImportPage() {
  const queryClient = useQueryClient();
  const { data: categories = [] } = useCategories();

  const [step, setStep] = useState<Step>("file");
  const [file, setFile] = useState<LoadedFile | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping | null>(null);
  const [options, setOptions] = useState<ParseOptions>({ dateFormat: "YYYY-MM-DD", decimal: ".", invertSigns: false });
  const [dateAmbiguous, setDateAmbiguous] = useState(false);
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [fallback, setFallback] = useState<Record<TransactionType, string>>({ expense: "", income: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importedCount, setImportedCount] = useState(0);

  async function handleFile(e: ChangeEvent<HTMLInputElement>): Promise<void> {
    const selected = e.target.files?.[0];
    e.target.value = ""; // let the same file be picked again after "Choose another file"
    if (!selected) return;
    setError(null);

    const table = parseCsv(await selected.text());
    if (table.length < 2) {
      setError("That file has no rows under its header line. Is it a CSV export?");
      return;
    }
    const [headers, ...dataRows] = table;
    if (dataRows.length > MAX_ROWS) {
      setError(`That file has ${dataRows.length} rows — split it into files of at most ${MAX_ROWS}.`);
      return;
    }

    const guessed = guessMapping(headers);
    const column = (idx: number) => (idx >= 0 ? dataRows.map((r) => r[idx] ?? "").slice(0, 200) : []);
    const detected = detectDateFormat(column(guessed.date), navigator.language);
    setFile({ name: selected.name, headers, dataRows });
    setMapping(guessed);
    setOptions({
      dateFormat: detected.format,
      decimal: detectDecimalSeparator([...column(guessed.amount), ...column(guessed.debit), ...column(guessed.credit)]),
      invertSigns: false,
    });
    setDateAmbiguous(detected.ambiguous);
    setStep("map");
  }

  async function goToReview(): Promise<void> {
    if (!file || !mapping) return;
    setBusy(true);
    setError(null);
    try {
      const parsed = buildRows(file.dataRows, mapping, options);
      const valid = parsed.filter((r) => !r.error);
      const duplicateIdx = valid.length
        ? await checkImportDuplicates(
            valid.map((r) => ({ date: r.date!, type: r.type!, amount: r.amount!, description: r.description }))
          )
        : [];
      const duplicateLines = new Set(duplicateIdx.map((i) => valid[i].line));

      setRows(
        parsed.map((r) => {
          const duplicate = duplicateLines.has(r.line);
          // Match a category column value to one of the user's categories
          // of the same type, by name (case-insensitive).
          const match = r.categoryName
            ? categories.find((c) => c.type === r.type && c.name.toLowerCase() === r.categoryName.toLowerCase())
            : undefined;
          return { ...r, duplicate, include: !r.error && !duplicate, categoryId: match?.id ?? "" };
        })
      );
      setStep("review");
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function runImport(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const count = await importTransactions(
        rows
          .filter((r) => r.include)
          .map((r) => ({
            date: r.date!,
            type: r.type!,
            amount: r.amount!,
            description: r.description,
            category: effectiveCategory(r, fallback),
          }))
      );
      // New transactions change the list, the dashboard and budget spend.
      void queryClient.invalidateQueries({ queryKey: ["transactions"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      void queryClient.invalidateQueries({ queryKey: ["budgets"] });
      setImportedCount(count);
      setStep("done");
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function startOver(): void {
    setStep("file");
    setFile(null);
    setMapping(null);
    setRows([]);
    setFallback({ expense: "", income: "" });
    setError(null);
  }

  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-8">
      <div className="mb-6 flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-xl font-semibold text-slate-900">Import transactions</h1>
        <Link to="/transactions" className="text-sm text-link hover:underline">
          Back to transactions
        </Link>
      </div>

      <ol className="mb-6 flex flex-wrap gap-2 text-sm">
        {(["file", "map", "review"] as const).map((s, i) => (
          <li
            key={s}
            className={`rounded-full px-3 py-1 ${step === s ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"}`}
          >
            {i + 1}. {s === "file" ? "Choose file" : s === "map" ? "Match columns" : "Review"}
          </li>
        ))}
      </ol>

      {step === "file" && (
        <div className="rounded-lg border border-slate-200 bg-surface p-6">
          <p className="mb-4 text-sm text-slate-600">
            Upload a CSV from your bank, or one exported from this app. Nothing is saved until you review the rows and
            confirm.
          </p>
          <label className={`${buttonClass} inline-block cursor-pointer`}>
            Choose CSV file
            <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => void handleFile(e)} />
          </label>
          {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
        </div>
      )}

      {step === "map" && file && mapping && (
        <MapColumnsStep
          fileName={file.name}
          headers={file.headers}
          dataRows={file.dataRows}
          mapping={mapping}
          onMappingChange={setMapping}
          options={options}
          onOptionsChange={setOptions}
          dateAmbiguous={dateAmbiguous}
          onBack={startOver}
          onContinue={() => void goToReview()}
          isChecking={busy}
          error={error}
        />
      )}

      {step === "review" && (
        <ReviewStep
          rows={rows}
          onRowsChange={setRows}
          categories={categories}
          fallback={fallback}
          onFallbackChange={setFallback}
          onBack={() => setStep("map")}
          onImport={() => void runImport()}
          isImporting={busy}
          error={error}
        />
      )}

      {step === "done" && (
        <div className="rounded-lg border border-slate-200 bg-surface p-6">
          <p className="mb-4 text-slate-900">
            Imported <span className="font-semibold">{importedCount}</span> transaction{importedCount === 1 ? "" : "s"}.
          </p>
          <div className="flex gap-3">
            <Link to="/transactions" className={buttonClass}>
              View transactions
            </Link>
            <button type="button" onClick={startOver} className="text-sm text-link hover:underline">
              Import another file
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
