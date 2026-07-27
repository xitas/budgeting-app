import bcrypt from "bcrypt";
import { HydratedDocument, Model, Schema, model } from "mongoose";

const SALT_ROUNDS = 12;

export interface IUser {
  email: string;
  passwordHash: string;
  name: string;
  refreshTokenVersion: number;
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
    const { passwordHash, __v, _id, ...rest } = ret;
    return rest;
  },
});

export const User = model<IUser, UserModel>("User", userSchema);
