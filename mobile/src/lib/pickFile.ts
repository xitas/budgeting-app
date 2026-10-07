import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";

// Opens the system file picker (Files / Drive / Downloads) and returns the
// chosen file's name and text, or null if the user backed out.
export async function pickTextFile(types: string[]): Promise<{ name: string; text: string } | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: types, copyToCacheDirectory: true, multiple: false });
  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];
  return { name: asset.name, text: await new File(asset.uri).text() };
}
