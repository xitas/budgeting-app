import { isCents } from "shared";

// Schema-level guard for every money field: amounts are stored as integer
// cents (see shared/src/money.ts), so a fractional value here means a caller
// skipped the conversion — reject it rather than store a silent unit error.
export const wholeCents = {
  validator: (value: number) => isCents(value),
  message: (props: { path: string; value: unknown }) => `${props.path} must be a whole number of cents (got ${String(props.value)})`,
};
