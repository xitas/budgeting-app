export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  // Only present for mobile clients (X-Client-Type: mobile); web gets an httpOnly cookie.
  refreshToken?: string;
}
