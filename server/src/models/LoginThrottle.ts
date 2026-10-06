import { Model, Schema, model } from "mongoose";

// Failed-login bookkeeping per email address (see loginThrottle.service.ts).
// Keyed by the normalised email whether or not an account exists, so the
// throttle behaves identically for both and can't be used to probe for
// accounts. Stored in MongoDB rather than memory so it holds across restarts
// and multiple API instances.
export interface ILoginThrottle {
  key: string;
  failures: number;
  nextAllowedAt?: Date;
  expiresAt: Date;
}

type LoginThrottleModel = Model<ILoginThrottle>;

const loginThrottleSchema = new Schema<ILoginThrottle, LoginThrottleModel>({
  key: { type: String, required: true, unique: true },
  failures: { type: Number, required: true, default: 0 },
  nextAllowedAt: { type: Date },
  // TTL index: MongoDB deletes the record once this passes, so a burst of
  // failures is forgotten a while after the last one — never a permanent lock.
  expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
});

export const LoginThrottle = model<ILoginThrottle, LoginThrottleModel>("LoginThrottle", loginThrottleSchema);
