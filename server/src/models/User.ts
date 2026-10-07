import bcrypt from "bcrypt";
import { HydratedDocument, Model, Schema, model } from "mongoose";
import { CURRENCY_CODES, DEFAULT_CURRENCY, type CurrencyCode } from "shared";

export const SALT_ROUNDS = 12;

export interface IUser {
  email: string;
  passwordHash: string;
  name: string;
  refreshTokenVersion: number;
  resetCodeHash?: string;
  resetCodeExpiresAt?: Date;
  resetCodeAttempts: number;
  // Missing on accounts created before email verification existed — those
  // count as verified (see toJSON). New sign-ups start at false.
  emailVerified?: boolean;
  currency: CurrencyCode;
  pendingEmail?: string;
  // One-time code for the email address: "verify" (sign-up) or "change"
  // (confirming pendingEmail). Same storage rules as the reset code.
  emailCodeHash?: string;
  emailCodeExpiresAt?: Date;
  emailCodeAttempts: number;
  emailCodePurpose?: "verify" | "change";
  // Last "someone tried to sign up with your address" notice, to avoid
  // flooding an inbox with them.
  signupNoticeSentAt?: Date;
}

export interface IUserMethods {
  comparePassword(candidate: string): Promise<boolean>;
}

export type UserDocument = HydratedDocument<IUser, IUserMethods>;

type UserModel = Model<IUser, {}, IUserMethods>;

// Internal, non-schema field used by the virtual below — never persisted.
type WithPendingPassword = UserDocument & { _password?: string };

const userSchema = new Schema<IUser, UserModel, IUserMethods>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    refreshTokenVersion: {
      type: Number,
      default: 0,
    },
    // Password reset: only a SHA-256 hash of the 6-digit code is stored, and
    // all three fields are cleared once the code is used or burned.
    resetCodeHash: {
      type: String,
      select: false,
    },
    resetCodeExpiresAt: {
      type: Date,
      select: false,
    },
    resetCodeAttempts: {
      type: Number,
      default: 0,
      select: false,
    },
    emailVerified: { type: Boolean },
    currency: { type: String, enum: CURRENCY_CODES, default: DEFAULT_CURRENCY },
    pendingEmail: { type: String, lowercase: true, trim: true },
    emailCodeHash: { type: String, select: false },
    emailCodeExpiresAt: { type: Date, select: false },
    emailCodeAttempts: { type: Number, default: 0, select: false },
    emailCodePurpose: { type: String, enum: ["verify", "change"], select: false },
    signupNoticeSentAt: { type: Date, select: false },
  },
  { timestamps: true }
);

// Write-only virtual: services set `user.password = plain` and this pre-save
// hook hashes it into `passwordHash`. Keeps bcrypt calls out of the service
// layer and is the classic Mongoose virtual + pre('save') pairing.
userSchema.virtual("password").set(function (this: WithPendingPassword, plain: string) {
  this._password = plain;
});

// Must run on 'validate', not 'save': Mongoose runs schema validation
// (including passwordHash's `required` check) before 'save' hooks fire, so
// hashing there would be too late and reject every new user.
userSchema.pre("validate", async function () {
  const self = this as WithPendingPassword;
  if (self._password) {
    self.passwordHash = await bcrypt.hash(self._password, SALT_ROUNDS);
  }
});

userSchema.method("comparePassword", function comparePassword(this: UserDocument, candidate: string) {
  return bcrypt.compare(candidate, this.passwordHash);
});

userSchema.set("toJSON", {
  virtuals: true,
  transform: (_doc, ret) => {
    const {
      passwordHash,
      resetCodeHash,
      resetCodeExpiresAt,
      resetCodeAttempts,
      emailCodeHash,
      emailCodeExpiresAt,
      emailCodeAttempts,
      emailCodePurpose,
      signupNoticeSentAt,
      __v,
      _id,
      ...rest
    } = ret;
    return { ...rest, emailVerified: rest.emailVerified !== false };
  },
});

export const User = model<IUser, UserModel>("User", userSchema);
