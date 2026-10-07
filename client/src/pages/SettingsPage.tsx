import { EmailSettings, PasswordSettings } from "../features/account/CredentialsSettings";
import { BackupSettings, DangerZone } from "../features/account/DataSettings";
import { AppearanceSettings, ProfileSettings } from "../features/account/ProfileSettings";

export function SettingsPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-8">
      <h1 className="text-xl font-semibold text-slate-900">Settings</h1>
      <ProfileSettings />
      <AppearanceSettings />
      <EmailSettings />
      <PasswordSettings />
      <BackupSettings />
      <DangerZone />
    </div>
  );
}
