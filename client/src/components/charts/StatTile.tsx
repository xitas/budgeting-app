type Tone = "positive" | "negative" | "neutral";

const TONE_CLASS: Record<Tone, string> = {
  positive: "text-green-700",
  negative: "text-red-600",
  neutral: "text-slate-900",
};

export function StatTile({ label, value, tone = "neutral" }: { label: string; value: string; tone?: Tone }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${TONE_CLASS[tone]}`}>{value}</p>
    </div>
  );
}
