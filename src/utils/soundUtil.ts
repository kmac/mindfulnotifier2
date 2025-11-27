import { AudioPlayer, createAudioPlayer, useAudioPlayer } from "expo-audio";

export const playSound = (audioSource: any) => {
  try {
    const player = useAudioPlayer(audioSource);
    player.play();
  } catch (error) {
    console.error("Error playing sound:", error);
  }
};

export const playSoundLoop = (
  audioSource: any,
  loop: boolean = false,
): AudioPlayer | null => {
  try {
    const player = createAudioPlayer(audioSource);
    player.loop = loop;
    player.play();
    return player;
  } catch (error) {
    console.error("Error playing sound:", error);
    return null;
  }
};

export const stopSound = (player: AudioPlayer) => {
  try {
    if (player) {
      player.pause();
      player.release();
    }
  } catch (error) {
    console.error("Error stopping sound:", error);
  }
};
