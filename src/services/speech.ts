// Synthèse vocale. La voix ne peut parler écran verrouillé que si le JS tourne :
// c'est le cas quand le suivi GPS en arrière-plan est actif (iOS réveille l'app à chaque position).
import { setAudioModeAsync } from 'expo-audio';
import * as Speech from 'expo-speech';
import { getState } from '../state/store';

let audioReady = false;

export async function configureAudio() {
  if (audioReady) return;
  try {
    await setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: 'duckOthers',
    });
    audioReady = true;
  } catch {
    // pas bloquant : la voix fonctionnera au moins écran allumé
  }
}

export function say(text: string, force = false) {
  const { prefs } = getState();
  if (!force && !prefs.voice) return;
  if (!text.trim()) return;
  Speech.speak(text, {
    language: 'fr-FR',
    rate: prefs.voiceRate,
    // iOS : session audio dédiée → le système baisse la musique pendant l'annonce puis la remet.
    useApplicationAudioSession: false,
  });
}

export function stopSpeaking() {
  Speech.stop().catch(() => {});
}
