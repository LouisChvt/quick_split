// Import / export de fichiers (GPX, plan JSON), sur téléphone et dans le navigateur.
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import type { Plan } from '../core/types';

/** Ouvre le sélecteur de fichiers et renvoie le texte du fichier choisi (ou null si annulé). */
export async function pickTextFile(): Promise<{ name: string; text: string } | null> {
  const res = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true, multiple: false });
  if (res.canceled || !res.assets?.length) return null;
  const asset = res.assets[0];
  // Navigateur : expo-file-system n'y est pas disponible, on lit le fichier fourni par le navigateur.
  if (Platform.OS === 'web') {
    const webFile = asset.file as unknown as { text(): Promise<string> } | undefined;
    const text = webFile ? await webFile.text() : await (await fetch(asset.uri)).text();
    return { name: asset.name, text };
  }
  const text = await new File(asset.uri).text();
  return { name: asset.name, text };
}

export async function exportPlan(plan: Plan) {
  const slug = plan.race.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'plan';
  const fileName = `plan-${slug}.json`;
  const json = JSON.stringify(plan);
  if (Platform.OS === 'web') {
    // Navigateur : téléchargement direct du fichier.
    const g = globalThis as unknown as {
      Blob: new (parts: string[], opts: { type: string }) => unknown;
      URL: { createObjectURL(b: unknown): string; revokeObjectURL(u: string): void };
      document: { createElement(t: string): { href: string; download: string; click(): void } };
    };
    const url = g.URL.createObjectURL(new g.Blob([json], { type: 'application/json' }));
    const a = g.document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    g.URL.revokeObjectURL(url);
    return fileName;
  }
  const file = new File(Paths.cache, fileName);
  file.create({ overwrite: true });
  await file.write(json);
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Exporter le plan' });
  }
  return file.uri;
}
