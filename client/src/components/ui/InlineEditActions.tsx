import { CheckIcon, XIcon } from "./icons";

interface InlineEditActionsProps {
  onSave: () => void;
  onCancel: () => void;
  isSaving?: boolean;
}

export function InlineEditActions({ onSave, onCancel, isSaving }: InlineEditActionsProps) {
  return (
    <span className="inline-flex items-center gap-1">
      <button
        type="button"
        onClick={onSave}
        disabled={isSaving}
        aria-label="Save"
        title="Save"
        className="rounded-md p-1.5 text-blue-600 transition-colors hover:bg-blue-50 disabled:opacity-50"
      >
        <CheckIcon className={`h-4 w-4 ${isSaving ? "animate-pulse" : ""}`} />
      </button>
      <button
        type="button"
        onClick={onCancel}
        aria-label="Cancel"
        title="Cancel"
        className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
      >
        <XIcon className="h-4 w-4" />
      </button>
    </span>
  );
}
