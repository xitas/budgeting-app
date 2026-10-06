import { zodResolver } from "@hookform/resolvers/zod";
import type { Resolver } from "react-hook-form";
import type { z } from "zod";

// zodResolver for schemas whose output differs from their input (e.g. an
// amount typed as "12.50" that validates into 1250 cents). At runtime
// @hookform/resolvers v3 already hands onSubmit the parsed (transformed)
// values; only its types predate react-hook-form's separate input/output
// form types, hence the cast.
export function zodFormResolver<S extends z.ZodTypeAny>(schema: S): Resolver<z.input<S>, unknown, z.output<S>> {
  return zodResolver(schema) as unknown as Resolver<z.input<S>, unknown, z.output<S>>;
}
