interface InlineEditActionsProps {
  onSave: () => void;
  onCancel: () => void;
  isSaving?: boolean;
}

export function InlineEditActions({ onSave, onCancel, isSaving }: InlineEditActionsProps) {
  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={onSave}
        disabled={isSaving}
        className="text-xs font-medium text-blue-600 transition-colors hover:text-blue-800 disabled:opacity-50"
      >
        {isSaving ? "Saving..." : "Save"}
      </button>
      <button type="button" onClick={onCancel} className="text-xs text-slate-400 transition-colors hover:text-slate-600">
        Cancel
      </button>
    </span>
  );
}
