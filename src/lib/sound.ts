import { store } from '@/src/store/store';
import { Platform } from 'react-native';

// Conditionally import react-native-sound only on native platforms
let Sound: any = null;
if (Platform.OS !== 'web') {
  Sound = require('react-native-sound').default;
  Sound.setCategory('Playback');
}

// Track current playing sound for stop functionality
let currentSound: any = null;
let currentWebAudio: HTMLAudioElement | null = null;

/**
 * Get the sound to use for notifications
 * Returns either:
 * - A sound URI for custom sounds
 * - A sound filename (without extension) for built-in sounds
 * - 'default' for the system default sound
 * - null if sound is disabled
 */
export function getSelectedSoundUri(): string | null {
  const state = store.getState();
  const { selectedSound, customSoundUri } = state.sound;

  // If system default sound is selected, return 'default'
  if (selectedSound === 'default') {
    return 'default';
  }

  // If custom sound is selected on Android, fallback to default
  // Android notifications can't use custom sounds from user files
  if (selectedSound === 'custom') {
    if (Platform.OS === 'android') {
      console.warn('[Sound] Custom sounds not supported on Android, using default');
      return 'zenbell_1'; // Fallback to zen bell
    }
    return customSoundUri;
  }

  // For built-in sounds, return the filename without extension
  // Android notifications expect sounds in res/raw without extension
  // Expo will copy these files to res/raw during build
  const soundMap: { [key: string]: string } = {
    'bell_inside.mp3': 'bell_inside',
    'bowl_struck.mp3': 'bowl_struck',
    'ding_soft.mp3': 'ding_soft',
    'tibetan_bell_ding_b.mp3': 'tibetan_bell_ding_b',
    'zenbell_1.mp3': 'zenbell_1',
  };

  return soundMap[selectedSound] || 'default';
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
 * Used for HTML5 Audio API in web
 * @param soundName The name of the sound (e.g., 'bell_inside.mp3' or 'custom')
 * @param customSoundUri The URI of the custom sound (if soundName is 'custom')
 * @returns The web-compatible path/URL for the sound, or null if not available
 */
export function getWebSoundPath(soundName: string, customSoundUri: string | null): string | null {
  // For custom sounds, check if it's a full URI
  if (soundName === 'custom') {
    if (!customSoundUri) {
      console.error('[Sound] No custom sound URI available');
      return null;
    }
    // If it's a custom sound with a full URI (http/file), use it directly
    if (customSoundUri.startsWith('http') || customSoundUri.startsWith('file://')) {
      return customSoundUri;
    }
    // Otherwise, it might be a relative path - return it as-is
    return customSoundUri;
  }

  // For built-in sounds, construct path to assets/sounds
  // The soundName includes the .mp3 extension
  const soundFileName = soundName.replace('.mp3', '');
  return `/assets/sounds/${soundFileName}.mp3`;
}

/**
 * Get the web-compatible path for the currently selected sound
 * @returns The web-compatible path/URL for the selected sound, or null if not available
 */
export function getSelectedWebSoundPath(): string | null {
  const state = store.getState();
  const { selectedSound, customSoundUri } = state.sound;
  return getWebSoundPath(selectedSound, customSoundUri);
}

/**
 * Play a sound on web using HTML5 Audio
 */
function playWebSound(soundPath: string, onFinish?: () => void): void {
  try {
    // Stop any currently playing sound
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
function playNativeSound(soundName: string, customSoundUri: string | null, onFinish?: () => void): void {
  try {
    // Stop any currently playing sound
    stopSound();

    // For custom sounds, use the URI directly
    if (soundName === 'custom' && customSoundUri) {
      currentSound = new Sound(customSoundUri, '', (error: any) => {
        if (error) {
          console.error('[Sound] Failed to load custom sound:', error);
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
      return;
    }

    // For built-in sounds, use require
    const soundMap: { [key: string]: any } = {
      'bell_inside.mp3': require('@/assets/sounds/bell_inside.mp3'),
      'bowl_struck.mp3': require('@/assets/sounds/bowl_struck.mp3'),
      'ding_soft.mp3': require('@/assets/sounds/ding_soft.mp3'),
      'tibetan_bell_ding_b.mp3': require('@/assets/sounds/tibetan_bell_ding_b.mp3'),
      'zenbell_1.mp3': require('@/assets/sounds/zenbell_1.mp3'),
    };

    const soundSource = soundMap[soundName];
    if (!soundSource) {
      console.error(`[Sound] No sound source found for ${soundName}`);
      if (onFinish) onFinish();
      return;
    }

    // react-native-sound can load from require() result
    currentSound = new Sound(soundSource, (error: any) => {
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
 * @param customSoundUri The URI of the custom sound (if soundName is 'custom')
 * @param onFinish Callback to call when playback finishes
 */
export function playSound(
  soundName: string,
  customSoundUri: string | null,
  onFinish?: () => void
): void {
  if (soundName === 'default') {
    // Can't preview system default sound
    console.log('[Sound] Cannot preview system default sound');
    if (onFinish) onFinish();
    return;
  }

  if (Platform.OS === 'web') {
    const soundPath = getWebSoundPath(soundName, customSoundUri);
    if (soundPath) {
      playWebSound(soundPath, onFinish);
    } else {
      if (onFinish) onFinish();
    }
  } else {
    playNativeSound(soundName, customSoundUri, onFinish);
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
 * Useful for one-off playback like notifications
 * @returns Promise that resolves when playback starts (does not wait for completion)
 */
export async function playSelectedSound(): Promise<void> {
  try {
    const soundEnabled = isSoundEnabled();
    if (!soundEnabled) {
      console.log('[Sound] Sound is disabled');
      return;
    }

    const state = store.getState();
    const { selectedSound, customSoundUri } = state.sound;

    if (selectedSound === 'default') {
      console.log('[Sound] System default sound - skipping playback');
      return;
    }

    console.log('[Sound] Playing selected sound');
    playSound(selectedSound, customSoundUri);
  } catch (error) {
    console.error('[Sound] Error playing selected sound:', error);
  }
}
