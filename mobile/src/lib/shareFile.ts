import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";

// Writes the text to the app's cache folder and opens the system share
// sheet, from which the user can save it to Files/Drive, email it, or open
// it in a spreadsheet app. The cache copy is overwritten on the next export.
export async function shareCsv(filename: string, csv: string, dialogTitle: string): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error("Sharing isn't available on this device.");
  }
  const file = new File(Paths.cache, filename);
  file.create({ overwrite: true });
  file.write(csv);
  await Sharing.shareAsync(file.uri, {
    mimeType: "text/csv",
    UTI: "public.comma-separated-values-text",
    dialogTitle,
  });
}
