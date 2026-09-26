import axios from "axios";

export function extractErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const message = (error.response?.data as { message?: string } | undefined)?.message;
    if (message) {
      return message;
    }
    if (!error.response) {
      return "Can't reach the server. Check that the API is running and your phone is on the same network.";
    }
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Something went wrong. Please try again.";
}
