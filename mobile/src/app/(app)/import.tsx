import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { FlatList, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import {
  DATE_FORMATS,
  buildRows,
  effectiveCategory,
  loadCsvForImport,
  reviewCounts,
  rowsForDuplicateCheck,
  rowsToImport,
  toReviewRows,
  type ColumnMapping,
  type LoadedCsv,
  type ParseOptions,
  type ReviewRow,
  type TransactionType,
} from "shared";
import { Button } from "../../components/ui/Button";
import { CategoryPicker } from "../../components/ui/CategoryPicker";
import { Card, SectionTitle } from "../../components/ui/layout";
import { Notice } from "../../components/ui/Notice";
import { SegmentedControl } from "../../components/ui/SegmentedControl";
import { radius, type Colors } from "../../components/ui/theme";
import { useColors, useThemedStyles } from "../../context/ThemeContext";
import { useCategories } from "../../features/categories/hooks";
import { checkImportDuplicates, importTransactions } from "../../features/transactions/api";
import { formatDisplayDate } from "../../lib/dates";
import { extractErrorMessage } from "../../lib/errors";
import { pickTextFile } from "../../lib/pickFile";
import { invalidateMoneyViews } from "../../lib/queryKeys";
import { useMoney } from "../../lib/useMoney";

// CSV import: same steps, parsing and duplicate check as the web app (the
// logic lives in shared/src/csvImport). Nothing is saved until "Import".

type Step = "file" | "map" | "review" | "done";
const PREVIEW_ROWS = 5;

function deviceLocale(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale;
  } catch {
    return undefined;
  }
}

export default function ImportScreen() {
  const styles = useThemedStyles(makeStyles);
  const queryClient = useQueryClient();
  const { data: categories = [] } = useCategories();
  const [step, setStep] = useState<Step>("file");
  const [fileName, setFileName] = useState("");
  const [loaded, setLoaded] = useState<LoadedCsv | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping | null>(null);
  const [options, setOptions] = useState<ParseOptions | null>(null);
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [fallback, setFallback] = useState<Record<TransactionType, string>>({ expense: "", income: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imported, setImported] = useState(0);

  async function run(action: () => Promise<void>): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function chooseFile(): Promise<void> {
    const file = await pickTextFile(["text/csv", "text/comma-separated-values", "text/plain", "application/vnd.ms-excel", "*/*"]);
    if (!file) return;
    const result = loadCsvForImport(file.text, deviceLocale());
    if ("error" in result) throw new Error(result.error);
    setFileName(file.name);
    setLoaded(result);
    setMapping(result.mapping);
    setOptions(result.options);
    setStep("map");
  }

  async function goToReview(): Promise<void> {
    if (!loaded || !mapping || !options) return;
    const parsed = buildRows(loaded.dataRows, mapping, options);
    const toCheck = rowsForDuplicateCheck(parsed);
    const duplicates = toCheck.length ? await checkImportDuplicates(toCheck) : [];
    setRows(toReviewRows(parsed, duplicates, categories));
    setStep("review");
  }

  async function runImport(): Promise<void> {
    const count = await importTransactions(rowsToImport(rows, fallback));
    invalidateMoneyViews(queryClient);
    setImported(count);
    setStep("done");
  }

  function startOver(): void {
    setStep("file");
    setLoaded(null);
    setRows([]);
    setFallback({ expense: "", income: "" });
    setError(null);
  }

  if (step === "file") {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.text}>Pick a CSV from your bank, or one exported from this app. Nothing is saved until you review the rows and confirm.</Text>
        <Button title={busy ? "Reading..." : "Choose CSV file"} disabled={busy} onPress={() => void run(chooseFile)} />
        {error ? <Notice tone="error">{error}</Notice> : null}
      </ScrollView>
    );
  }

  if (step === "map" && loaded && mapping && options) {
    return (
      <MapStep
        fileName={fileName}
        loaded={loaded}
        mapping={mapping}
        onMappingChange={setMapping}
        options={options}
        onOptionsChange={setOptions}
        busy={busy}
        error={error}
        onBack={startOver}
        onContinue={() => void run(goToReview)}
      />
    );
  }

  if (step === "review") {
    return (
      <ReviewStep
        rows={rows}
        onRowsChange={setRows}
        categories={categories}
        fallback={fallback}
        onFallbackChange={setFallback}
        busy={busy}
        error={error}
        onBack={() => setStep("map")}
        onImport={() => void run(runImport)}
      />
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Notice tone="success">{`Imported ${imported} transaction${imported === 1 ? "" : "s"}.`}</Notice>
      <Button title="View transactions" onPress={() => router.back()} />
      <Button title="Import another file" variant="ghost" onPress={startOver} />
    </ScrollView>
  );
}

// ------------------------------------------------------------ mapping step

function Chips<T extends string | number>({ label, options, value, onChange }: { label: string; options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {options.map((o) => {
          const selected = o.value === value;
          return (
            <Pressable
              key={String(o.value)}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={`${label}: ${o.label}`}
              onPress={() => onChange(o.value)}
              style={[styles.chip, selected && styles.chipSelected]}
            >
              <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]} numberOfLines={1}>
                {o.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

function columnOptions(headers: string[], optional: boolean): { value: number; label: string }[] {
  return [...(optional ? [{ value: -1, label: "None" }] : []), ...headers.map((h, i) => ({ value: i, label: h || `Column ${i + 1}` }))];
}

interface MapStepProps {
  fileName: string;
  loaded: LoadedCsv;
  mapping: ColumnMapping;
  onMappingChange: (m: ColumnMapping) => void;
  options: ParseOptions;
  onOptionsChange: (o: ParseOptions) => void;
  busy: boolean;
  error: string | null;
  onBack: () => void;
  onContinue: () => void;
}

function MapStep({ fileName, loaded, mapping, onMappingChange, options, onOptionsChange, busy, error, onBack, onContinue }: MapStepProps) {
  const styles = useThemedStyles(makeStyles);
  const colors = useColors();
  const money = useMoney();
  const set = (patch: Partial<ColumnMapping>) => onMappingChange({ ...mapping, ...patch });
  const preview = buildRows(loaded.dataRows.slice(0, PREVIEW_ROWS), mapping, options);
  const amountMapped = mapping.amountMode === "signed" ? mapping.amount >= 0 : mapping.debit >= 0 || mapping.credit >= 0;
  const headers = loaded.headers;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.text}>
        <Text style={styles.strong}>{fileName}</Text> · {loaded.dataRows.length} rows. Check which column holds what — the preview below updates as you go.
      </Text>
      <Chips label="Date" options={columnOptions(headers, false)} value={mapping.date} onChange={(date) => set({ date })} />
      <Chips label="Description" options={columnOptions(headers, true)} value={mapping.description} onChange={(description) => set({ description })} />
      <View style={styles.field}>
        <Text style={styles.label}>Amount</Text>
        <SegmentedControl
          options={[
            { value: "signed", label: "One column" },
            { value: "debitCredit", label: "Money out / in" },
          ]}
          value={mapping.amountMode}
          onChange={(amountMode) => set({ amountMode })}
        />
      </View>
      {mapping.amountMode === "signed" ? (
        <Chips label="Amount column (negative = money out)" options={columnOptions(headers, false)} value={mapping.amount} onChange={(amount) => set({ amount })} />
      ) : (
        <>
          <Chips label="Money out (debit)" options={columnOptions(headers, true)} value={mapping.debit} onChange={(debit) => set({ debit })} />
          <Chips label="Money in (credit)" options={columnOptions(headers, true)} value={mapping.credit} onChange={(credit) => set({ credit })} />
        </>
      )}
      <Chips label="Type column (income / expense)" options={columnOptions(headers, true)} value={mapping.type} onChange={(type) => set({ type })} />
      <Chips label="Category column" options={columnOptions(headers, true)} value={mapping.category} onChange={(category) => set({ category })} />
      <Chips label="Date format" options={DATE_FORMATS} value={options.dateFormat} onChange={(dateFormat) => onOptionsChange({ ...options, dateFormat })} />
      {loaded.dateAmbiguous ? <Notice tone="info">These dates fit more than one format — check the preview shows the right days.</Notice> : null}
      <Chips
        label="Decimal separator"
        options={[
          { value: ".", label: "Dot — 1,234.56" },
          { value: ",", label: "Comma — 1.234,56" },
        ]}
        value={options.decimal}
        onChange={(decimal) => onOptionsChange({ ...options, decimal })}
      />
      <View style={styles.switchRow}>
        <Text style={styles.text}>Flip signs (my bank lists spending as positive numbers)</Text>
        <Switch
          accessibilityLabel="Flip signs"
          value={options.invertSigns}
          onValueChange={(invertSigns) => onOptionsChange({ ...options, invertSigns })}
          trackColor={{ true: colors.primary, false: colors.inputBorder }}
        />
      </View>

      <SectionTitle>{`Preview (first ${Math.min(PREVIEW_ROWS, loaded.dataRows.length)} rows)`}</SectionTitle>
      <Card style={styles.listCard}>
        {preview.map((row, i) => (
          <View key={row.line} style={[styles.previewRow, i > 0 && styles.rowBorder]}>
            {row.error ? (
              <Text style={styles.error}>
                Line {row.line}: {row.error}
              </Text>
            ) : (
              <>
                <View style={styles.flex}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {row.description || "—"}
                  </Text>
                  <Text style={styles.rowMeta}>
                    {formatDisplayDate(row.date!)} · {row.type}
                    {row.categoryName ? ` · ${row.categoryName}` : ""}
                  </Text>
                </View>
                <Text style={[styles.amount, row.type === "income" && styles.income]}>{money.signed(row.amountCents!, row.type!)}</Text>
              </>
            )}
          </View>
        ))}
      </Card>
      {error ? <Notice tone="error">{error}</Notice> : null}
      <Button title={busy ? "Checking..." : "Review rows"} disabled={busy || mapping.date < 0 || !amountMapped} onPress={onContinue} />
      <Button title="Choose another file" variant="ghost" onPress={onBack} />
    </ScrollView>
  );
}

// ------------------------------------------------------------- review step

interface ReviewStepProps {
  rows: ReviewRow[];
  onRowsChange: (rows: ReviewRow[]) => void;
  categories: { id: string; name: string; color: string; type: TransactionType }[];
  fallback: Record<TransactionType, string>;
  onFallbackChange: (f: Record<TransactionType, string>) => void;
  busy: boolean;
  error: string | null;
  onBack: () => void;
  onImport: () => void;
}

function ReviewStep({ rows, onRowsChange, categories, fallback, onFallbackChange, busy, error, onBack, onImport }: ReviewStepProps) {
  const styles = useThemedStyles(makeStyles);
  const colors = useColors();
  const money = useMoney();
  const counts = reviewCounts(rows, fallback);
  const nameOf = (id: string) => categories.find((c) => c.id === id)?.name;
  const update = (line: number, patch: Partial<ReviewRow>) => onRowsChange(rows.map((r) => (r.line === line ? { ...r, ...patch } : r)));
  const setAll = (include: boolean) => onRowsChange(rows.map((r) => (r.error ? r : { ...r, include })));

  const header = (
    <View style={styles.reviewHeader}>
      <Text style={styles.text}>
        {counts.selected} selected to import
        {counts.duplicates ? ` · ${counts.duplicates} look like transactions you already have (unticked)` : ""}
        {counts.invalid ? ` · ${counts.invalid} can't be read (listed with their line numbers)` : ""}
      </Text>
      {(["expense", "income"] as const).map((type) =>
        counts.needsFallback[type] ? (
          <CategoryPicker
            key={type}
            label={`Category for unmatched ${type === "expense" ? "expenses" : "income"}`}
            categories={categories.filter((c) => c.type === type)}
            value={fallback[type]}
            onChange={(id) => onFallbackChange({ ...fallback, [type]: id })}
            error={!fallback[type] ? "Required" : undefined}
          />
        ) : null
      )}
      <View style={styles.selectRow}>
        <Button title="Select all" variant="ghost" onPress={() => setAll(true)} />
        <Button title="Select none" variant="ghost" onPress={() => setAll(false)} />
      </View>
    </View>
  );

  const footer = (
    <View style={styles.reviewFooter}>
      {counts.missingCategory ? (
        <Notice tone="error">{`${counts.missingCategory} selected ${counts.missingCategory === 1 ? "row needs" : "rows need"} a category — pick one above.`}</Notice>
      ) : null}
      {error ? <Notice tone="error">{error}</Notice> : null}
      <Button
        title={busy ? "Importing..." : `Import ${counts.selected} transaction${counts.selected === 1 ? "" : "s"}`}
        disabled={busy || counts.selected === 0 || counts.missingCategory > 0}
        onPress={onImport}
      />
      <Button title="Back to columns" variant="ghost" onPress={onBack} />
    </View>
  );

  return (
    <FlatList
      data={rows}
      keyExtractor={(r) => String(r.line)}
      contentContainerStyle={styles.reviewList}
      ListHeaderComponent={header}
      ListFooterComponent={footer}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      renderItem={({ item: row }) =>
        row.error ? (
          <View style={styles.reviewRow}>
            <Text style={styles.error}>
              Line {row.line}: {row.error}
            </Text>
          </View>
        ) : (
          <View style={[styles.reviewRow, !row.include && styles.dim]}>
            <Switch
              accessibilityLabel={`Import line ${row.line}`}
              value={row.include}
              onValueChange={(include) => update(row.line, { include })}
              trackColor={{ true: colors.primary, false: colors.inputBorder }}
            />
            <View style={styles.flex}>
              <Text style={styles.rowTitle} numberOfLines={1}>
                {row.description || "—"}
              </Text>
              <Text style={styles.rowMeta} numberOfLines={1}>
                {formatDisplayDate(row.date!)} ·{" "}
                {row.categoryId ? nameOf(row.categoryId) : effectiveCategory(row, fallback) ? `Unmatched → ${nameOf(fallback[row.type!])}` : "Needs a category"}
              </Text>
              {row.duplicate ? <Text style={styles.badge}>Possible duplicate</Text> : null}
            </View>
            <Text style={[styles.amount, row.type === "income" && styles.income]}>{money.signed(row.amountCents!, row.type!)}</Text>
          </View>
        )
      }
    />
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    container: { padding: 16, gap: 14, paddingBottom: 40 },
    flex: { flex: 1 },
    text: { fontSize: 14, lineHeight: 20, color: colors.textMuted, flexShrink: 1 },
    strong: { fontWeight: "600", color: colors.text },
    field: { gap: 6 },
    label: { fontSize: 14, fontWeight: "500", color: colors.text },
    chips: { gap: 8 },
    chip: { borderWidth: 1, borderColor: colors.inputBorder, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: colors.surface, maxWidth: 220 },
    chipSelected: { borderColor: colors.link, backgroundColor: colors.selectedBg },
    chipLabel: { fontSize: 13, color: colors.text },
    chipLabelSelected: { color: colors.selectedText, fontWeight: "600" },
    switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
    listCard: { padding: 0 },
    previewRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 10 },
    rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
    rowTitle: { fontSize: 15, color: colors.text },
    rowMeta: { fontSize: 13, color: colors.textSubtle },
    amount: { fontSize: 15, fontWeight: "600", color: colors.text, fontVariant: ["tabular-nums"] },
    income: { color: colors.positive },
    error: { fontSize: 13, color: colors.danger },
    reviewList: { paddingBottom: 40 },
    reviewHeader: { padding: 16, gap: 12 },
    reviewFooter: { padding: 16, gap: 10 },
    selectRow: { flexDirection: "row", gap: 12 },
    reviewRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: colors.surface },
    dim: { opacity: 0.5 },
    separator: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
    badge: {
      alignSelf: "flex-start",
      marginTop: 2,
      fontSize: 12,
      color: colors.textMuted,
      backgroundColor: colors.background,
      borderRadius: radius.md,
      paddingHorizontal: 6,
      paddingVertical: 1,
      overflow: "hidden",
    },
  });
