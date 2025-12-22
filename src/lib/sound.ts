import { store } from '@/src/store/store';
import { Platform } from 'react-native';

// Conditionally import react-native-sound only on native platforms
let Sound: any = null;
if (Platform.OS !== 'web') {
  Sound = require('react-native-sound');
  Sound.setCategory('Playback');
}

// Track current playing sound for stop functionality
let currentSound: any = null;
let currentWebAudio: HTMLAudioElement | null = null;

// Map sound names to filenames (without extension)
const SOUND_FILE_MAP: { [key: string]: string } = {
  'bell_inside.mp3': 'bell_inside',
  'bowl_struck.mp3': 'bowl_struck',
  'ding_soft.mp3': 'ding_soft',
  'tibetan_bell_ding_b.mp3': 'tibetan_bell_ding_b',
  'zenbell_1.mp3': 'zenbell_1',
};

/**
 * Get the sound to use for notifications
 * Returns either:
 * - A sound filename (without extension) for built-in sounds
 * - 'default' for the system default sound
 */
export function getSelectedSoundUri(): string {
  const state = store.getState();
  const { selectedSound } = state.sound;

  if (selectedSound === 'default') {
    return 'default';
  }

  return SOUND_FILE_MAP[selectedSound] || 'default';
}

/**
 * Check if sound is enabled in preferences
 */
export function isSoundEnabled(): boolean {
  const state = store.getState();
  return state.preferences.soundEnabled;
}

/**
 * Check if vibration is enabled in preferences
 */
export function isVibrationEnabled(): boolean {
  const state = store.getState();
  return state.preferences.vibrationEnabled;
}

/**
 * Get the web-compatible path for a sound
 */
function getWebSoundPath(soundName: string): string | null {
  const soundFile = SOUND_FILE_MAP[soundName];
  if (!soundFile) {
    return null;
  }
  return `/assets/sounds/${soundFile}.mp3`;
}

/**
 * Play a sound on web using HTML5 Audio
 */
function playWebSound(soundPath: string, onFinish?: () => void): void {
  try {
    stopSound();

    currentWebAudio = new Audio(soundPath);
    currentWebAudio.addEventListener('ended', () => {
      currentWebAudio = null;
      if (onFinish) onFinish();
    });
    currentWebAudio.addEventListener('error', (e) => {
      console.error('[Sound] Web audio error:', e);
      currentWebAudio = null;
      if (onFinish) onFinish();
    });
    currentWebAudio.play().catch((error) => {
      console.error('[Sound] Web audio play error:', error);
      currentWebAudio = null;
      if (onFinish) onFinish();
    });
  } catch (error) {
    console.error('[Sound] Error playing web sound:', error);
    if (onFinish) onFinish();
  }
}

/**
 * Play a sound on native using react-native-sound
 */
function playNativeSound(soundName: string, onFinish?: () => void): void {
  try {
    stopSound();

    const soundFile = SOUND_FILE_MAP[soundName];
    if (!soundFile) {
      console.error(`[Sound] No sound file found for ${soundName}`);
      if (onFinish) onFinish();
      return;
    }

    const fileName = `${soundFile}.mp3`;

    currentSound = new Sound(fileName, Sound.MAIN_BUNDLE, (error: any) => {
      if (error) {
        console.error('[Sound] Failed to load sound:', error);
        currentSound = null;
        if (onFinish) onFinish();
        return;
      }
      currentSound.play((success: boolean) => {
        if (!success) {
          console.error('[Sound] Playback failed');
        }
        currentSound?.release();
        currentSound = null;
        if (onFinish) onFinish();
      });
    });
  } catch (error) {
    console.error('[Sound] Error playing native sound:', error);
    if (onFinish) onFinish();
  }
}

/**
 * Play a sound for preview
 * @param soundName The name of the sound to play
 * @param onFinish Callback to call when playback finishes
 */
export function playSound(soundName: string, onFinish?: () => void): void {
  if (soundName === 'default') {
    console.log('[Sound] Cannot preview system default sound');
    if (onFinish) onFinish();
    return;
  }

  if (Platform.OS === 'web') {
    const soundPath = getWebSoundPath(soundName);
    if (soundPath) {
      playWebSound(soundPath, onFinish);
    } else {
      if (onFinish) onFinish();
    }
  } else {
    playNativeSound(soundName, onFinish);
  }
}

/**
 * Stop the currently playing sound
 */
export function stopSound(): void {
  if (Platform.OS === 'web') {
    if (currentWebAudio) {
      currentWebAudio.pause();
      currentWebAudio.currentTime = 0;
      currentWebAudio = null;
    }
  } else {
    if (currentSound) {
      currentSound.stop();
      currentSound.release();
      currentSound = null;
    }
  }
}

/**
 * Play the currently selected sound
 */
export async function playSelectedSound(): Promise<void> {
  try {
    if (!isSoundEnabled()) {
      return;
    }

    const state = store.getState();
    const { selectedSound } = state.sound;

    if (selectedSound === 'default') {
      return;
    }

    playSound(selectedSound);
  } catch (error) {
    console.error('[Sound] Error playing selected sound:', error);
  }
}
