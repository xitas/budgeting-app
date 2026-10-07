import { ClientSession } from "mongoose";
import type { CurrencyCode } from "shared";
import { Budget } from "../models/Budget";
import { Category } from "../models/Category";
import { Loan } from "../models/Loan";
import { LoginThrottle } from "../models/LoginThrottle";
import { RecurringTransaction } from "../models/RecurringTransaction";
import { Transaction } from "../models/Transaction";
import { User, UserDocument } from "../models/User";
import { AppError } from "../utils/AppError";
import { sendMail } from "../utils/mailer";
import { withTransaction } from "../utils/withTransaction";
import { AuthResult, assertPassword, issueTokens } from "./auth.service";
import { CODE_TTL_MS, checkCode, clearCode, codeFields, codeIssuedRecently, issueCode } from "./oneTimeCode";

async function loadUser(userId: string, select?: string): Promise<UserDocument> {
  const query = User.findById(userId);
  const user = await (select ? query.select(select) : query);
  if (!user) throw new AppError(404, "User not found");
  return user;
}

export async function updateProfile(userId: string, updates: { name?: string; currency?: CurrencyCode }): Promise<UserDocument> {
  const user = await loadUser(userId);
  if (updates.name !== undefined) user.name = updates.name;
  if (updates.currency !== undefined) user.currency = updates.currency;
  await user.save();
  return user;
}

// Signs out every other device (their refresh tokens stop working) and
// returns fresh tokens so the device that made the change stays signed in.
export async function changePassword(userId: string, currentPassword: string, newPassword: string): Promise<AuthResult> {
  const user = await loadUser(userId);
  await assertPassword(user, currentPassword, "Current password is incorrect");
  if (currentPassword === newPassword) {
    throw new AppError(400, "The new password must be different from the current one");
  }
  (user as unknown as { password: string }).password = newPassword;
  user.refreshTokenVersion += 1;
  await user.save();
  await sendMail({
    to: user.email,
    subject: "Your password was changed",
    text: `Hi ${user.name},\n\nThe password for your Budget App account was just changed, and other devices were signed out.\n\nIf this wasn't you, reset your password from the login screen right away.`,
  });
  return { user, ...issueTokens(user) };
}

// Step 1 of an email change: a code goes to the NEW address, so only someone
// who controls it can finish. If that address already belongs to another
// account, its owner gets a heads-up instead and the code is never sent —
// the response (and pendingEmail) look the same, so this can't be used to
// check which addresses have accounts.
export async function requestEmailChange(userId: string, newEmail: string, password: string): Promise<UserDocument> {
  const user = await loadUser(userId, codeFields("email"));
  await assertPassword(user, password);
  const target = newEmail.trim().toLowerCase();
  if (target === user.email) {
    throw new AppError(400, "That's already your email address");
  }
  // Cooldown between email-change codes only (a just-sent sign-up
  // verification code shares the slot and is simply replaced).
  if (user.emailCodePurpose === "change" && codeIssuedRecently(user, "email")) {
    throw new AppError(429, "A code was sent less than a minute ago. Wait a moment before asking for another.");
  }

  const code = issueCode(user, "email");
  user.emailCodePurpose = "change";
  user.pendingEmail = target;
  await user.save();

  const owner = await User.exists({ email: target, _id: { $ne: user._id } });
  if (owner) {
    await sendMail({
      to: target,
      subject: "Someone tried to use your email address",
      text: "Someone asked to move a different Budget App account to this email address. Since it's already yours, nothing was changed and no code was sent. You don't need to do anything.",
    });
  } else {
    await sendMail({
      to: target,
      subject: "Confirm your new email address",
      text:
        `Hi ${user.name},\n\n` +
        `Your code to confirm this as your new Budget App email is: ${code}\n\n` +
        `It expires in ${CODE_TTL_MS / 60_000} minutes. If you didn't ask for this, ignore this email — your account stays on its current address.`,
    });
  }
  return user;
}

// Step 2: the code from the new address makes the switch.
export async function confirmEmailChange(userId: string, code: string): Promise<UserDocument> {
  const user = await loadUser(userId, codeFields("email"));
  const invalid = new AppError(400, "Invalid or expired code");
  if (!user.pendingEmail || user.emailCodePurpose !== "change") throw invalid;
  if (!checkCode(user, "email", code)) {
    await user.save();
    throw invalid;
  }
  if (await User.exists({ email: user.pendingEmail, _id: { $ne: user._id } })) {
    throw new AppError(409, "That email address is now used by another account");
  }

  const oldEmail = user.email;
  user.email = user.pendingEmail;
  user.pendingEmail = undefined;
  user.emailVerified = true; // the code proved the new address
  clearCode(user, "email");
  await user.save();
  await LoginThrottle.deleteMany({ key: { $in: [oldEmail, user.email] } });
  await sendMail({
    to: oldEmail,
    subject: "Your email address was changed",
    text: `Hi ${user.name},\n\nYour Budget App account now uses ${user.email}. You'll log in with that address from now on.\n\nIf this wasn't you, contact support right away.`,
  });
  return user;
}

export async function cancelEmailChange(userId: string): Promise<UserDocument> {
  const user = await loadUser(userId, codeFields("email"));
  if (user.emailCodePurpose === "change") clearCode(user, "email");
  user.pendingEmail = undefined;
  await user.save();
  return user;
}

// Every refresh token (all devices, this one included) stops working.
// Access tokens are short-lived (JWT_ACCESS_EXPIRES_IN) and lapse on their own.
export async function signOutEverywhere(userId: string): Promise<void> {
  await User.updateOne({ _id: userId }, { $inc: { refreshTokenVersion: 1 } });
}

// Everything the user owns except the user document itself.
export async function deleteUserData(userId: string, session: ClientSession): Promise<void> {
  await Transaction.deleteMany({ user: userId }, { session });
  await Loan.deleteMany({ user: userId }, { session });
  await RecurringTransaction.deleteMany({ user: userId }, { session });
  await Budget.deleteMany({ user: userId }, { session });
  await Category.deleteMany({ user: userId }, { session });
}

// Permanent: the user and all their data go in one transaction. With the
// user gone, every refresh token is invalid, so all devices are signed out.
export async function deleteAccount(userId: string, password: string): Promise<void> {
  const user = await loadUser(userId);
  await assertPassword(user, password);
  await withTransaction(async (session) => {
    await deleteUserData(userId, session);
    await User.deleteOne({ _id: userId }, { session });
  });
  await LoginThrottle.deleteMany({ key: user.email });
  await sendMail({
    to: user.email,
    subject: "Your Budget App account was deleted",
    text: `Hi ${user.name},\n\nYour account and all of its data have been permanently deleted, as you asked. Thanks for using Budget App.`,
  });
}
