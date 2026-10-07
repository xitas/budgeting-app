import { router } from "expo-router";
import { FormScreen } from "../../../components/ui/layout";
import { useAuth } from "../../../context/AuthContext";
import { VerifyEmailForm } from "../../../features/auth/VerifyEmailForm";

// Opened from the "verify your email" banner while signed in.
export default function VerifyEmailModal() {
  const { user } = useAuth();
  return (
    <FormScreen>
      <VerifyEmailForm email={user?.email ?? ""} onVerified={() => router.back()} />
    </FormScreen>
  );
}
