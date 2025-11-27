import { store } from '@/src/store/store';
import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import { Platform } from 'react-native';

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
 * Get the Audio.Sound source for playing the selected sound
 * This is different from notification sounds - used for preview playback
 */
export function getSelectedSoundSource(): any {
  const state = store.getState();
  const { selectedSound, customSoundUri } = state.sound;

  if (selectedSound === 'custom' && customSoundUri) {
    return { uri: customSoundUri };
  }

  const soundMap: { [key: string]: any } = {
    'bell_inside.mp3': require('@/assets/sounds/bell_inside.mp3'),
    'bowl_struck.mp3': require('@/assets/sounds/bowl_struck.mp3'),
    'ding_soft.mp3': require('@/assets/sounds/ding_soft.mp3'),
    'tibetan_bell_ding_b.mp3': require('@/assets/sounds/tibetan_bell_ding_b.mp3'),
    'zenbell_1.mp3': require('@/assets/sounds/zenbell_1.mp3'),
  };

  return soundMap[selectedSound] || null;
}

/**
 * Get the sound source for a specific sound name
 * Used for preview playback in the sound settings
 * @param soundName The name of the sound (e.g., 'bell_inside.mp3' or 'custom')
 * @param customSoundUri The URI of the custom sound (if soundName is 'custom')
 * @returns The sound source that can be used with AudioPlayer
 */
export function getSoundSourceForName(soundName: string, customSoundUri: string | null): any {
  if (soundName === 'custom') {
    if (!customSoundUri) {
      console.error('[Sound] No custom sound URI available');
      return null;
    }
    return { uri: customSoundUri };
  }

  const soundMap: { [key: string]: any } = {
    'bell_inside.mp3': require('@/assets/sounds/bell_inside.mp3'),
    'bowl_struck.mp3': require('@/assets/sounds/bowl_struck.mp3'),
    'ding_soft.mp3': require('@/assets/sounds/ding_soft.mp3'),
    'tibetan_bell_ding_b.mp3': require('@/assets/sounds/tibetan_bell_ding_b.mp3'),
    'zenbell_1.mp3': require('@/assets/sounds/zenbell_1.mp3'),
  };

  return soundMap[soundName] || null;
}

/**
 * Play a sound using the AudioPlayer
 * @param audioPlayer The AudioPlayer instance
 * @param soundName The name of the sound to play
 * @param customSoundUri The URI of the custom sound (if soundName is 'custom')
 * @param onFinish Callback to call when playback finishes
 */
export function playSound(
  audioPlayer: AudioPlayer,
  soundName: string,
  customSoundUri: string | null,
  onFinish?: () => void
): void {
  try {
    const soundSource = getSoundSourceForName(soundName, customSoundUri);
    if (!soundSource) {
      console.error(`[Sound] No sound source found for ${soundName}`);
      if (onFinish) onFinish();
      return;
    }

    // Replace current audio and play
    audioPlayer.replace(soundSource);
    audioPlayer.play();

    // Listen for when playback finishes
    if (onFinish) {
      const subscription = audioPlayer.addListener('playbackStatusUpdate', (status) => {
        if (status.isLoaded && status.didJustFinish) {
          onFinish();
          subscription.remove();
        }
      });
    }
  } catch (error) {
    console.error('[Sound] Error playing sound:', error);
    if (onFinish) onFinish();
  }
}

/**
 * Stop the currently playing sound
 * @param audioPlayer The AudioPlayer instance
 */
export function stopSound(audioPlayer: AudioPlayer): void {
  audioPlayer.pause();
}

/**
 * Get the web-compatible path for a sound
 * Used for HTML5 Audio API in web notifications
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
 * Play the currently selected sound using a temporary AudioPlayer
 * Creates and manages its own AudioPlayer instance, useful for one-off playback like notifications
 * @returns Promise that resolves when playback starts (does not wait for completion)
 */
export async function playSelectedSound(): Promise<void> {
  try {
    const soundEnabled = isSoundEnabled();
    if (!soundEnabled) {
      console.log('[Sound] Sound is disabled');
      return;
    }

    const soundSource = getSelectedSoundSource();
    if (!soundSource) {
      console.log('[Sound] No sound source available');
      return;
    }

    console.log('[Sound] Playing selected sound');

    // Create a temporary audio player that doesn't auto-release
    const player = createAudioPlayer(soundSource);

    // Play the sound
    player.play();

    // Clean up after playback finishes
    const subscription = player.addListener('playbackStatusUpdate', (status) => {
      if (status.isLoaded && status.didJustFinish) {
        subscription.remove();
        player.remove();
      }
    });
  } catch (error) {
    console.error('[Sound] Error playing selected sound:', error);
  }
}
