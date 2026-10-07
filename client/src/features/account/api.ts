import type {
  AuthResponse,
  BackupPreviewResponse,
  ChangePasswordInput,
  ImportBackupResponse,
  UpdateProfileInput,
  User,
} from "shared";
import { apiClient } from "../../lib/apiClient";

export async function updateProfile(input: UpdateProfileInput): Promise<User> {
  const res = await apiClient.patch<{ user: User }>("/account/profile", input);
  return res.data.user;
}

// Returns fresh tokens: other devices are signed out, this one stays in.
export async function changePassword(input: ChangePasswordInput): Promise<AuthResponse> {
  const res = await apiClient.post<AuthResponse>("/account/password", input);
  return res.data;
}

export async function requestEmailChange(newEmail: string, password: string): Promise<{ user: User; message: string }> {
  const res = await apiClient.post<{ user: User; message: string }>("/account/email", { newEmail, password });
  return res.data;
}

export async function confirmEmailChange(code: string): Promise<User> {
  const res = await apiClient.post<{ user: User }>("/account/email/confirm", { code });
  return res.data.user;
}

export async function cancelEmailChange(): Promise<User> {
  const res = await apiClient.delete<{ user: User }>("/account/email/pending");
  return res.data.user;
}

export async function signOutEverywhere(): Promise<void> {
  await apiClient.post("/account/sign-out-everywhere");
}

export async function deleteAccount(password: string): Promise<void> {
  await apiClient.delete("/account", { data: { password } });
}

export async function downloadBackup(): Promise<Blob> {
  const res = await apiClient.get<Blob>("/account/backup", { responseType: "blob" });
  return res.data;
}

export async function previewBackup(backup: unknown): Promise<BackupPreviewResponse> {
  const res = await apiClient.post<BackupPreviewResponse>("/account/backup/preview", { backup });
  return res.data;
}

export async function importBackup(backup: unknown, replaceExisting: boolean): Promise<ImportBackupResponse> {
  const res = await apiClient.post<ImportBackupResponse>("/account/backup/import", { backup, replaceExisting });
  return res.data;
}
