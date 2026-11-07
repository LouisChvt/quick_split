// Import / export de fichiers (GPX, plan JSON).
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { Plan } from '../core/types';

/** Ouvre le sélecteur de fichiers et renvoie le texte du fichier choisi (ou null si annulé). */
export async function pickTextFile(): Promise<{ name: string; text: string } | null> {
  const res = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true, multiple: false });
  if (res.canceled || !res.assets?.length) return null;
  const asset = res.assets[0];
  const text = await new File(asset.uri).text();
  return { name: asset.name, text };
}

export async function exportPlan(plan: Plan) {
  const slug = plan.race.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'plan';
  const file = new File(Paths.cache, `plan-${slug}.json`);
  file.create({ overwrite: true });
  await file.write(JSON.stringify(plan));
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Exporter le plan' });
  }
  return file.uri;
}
