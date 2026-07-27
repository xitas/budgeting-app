import { apiClient } from "../../lib/apiClient";
import type { AuthResponse, User } from "./types";

export async function signup(email: string, password: string, name: string): Promise<AuthResponse> {
  const res = await apiClient.post<AuthResponse>("/auth/signup", { email, password, name });
  return res.data;
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const res = await apiClient.post<AuthResponse>("/auth/login", { email, password });
  return res.data;
}

export async function logout(): Promise<void> {
  await apiClient.post("/auth/logout");
}

export async function me(): Promise<{ user: User }> {
  const res = await apiClient.get<{ user: User }>("/auth/me");
  return res.data;
}
