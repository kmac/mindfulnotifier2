import { Platform } from 'react-native';

export function oneShotAt(date: Date, callback: Function) {

  console.log(`oneShotAt: ${date}, platform: ${Platform.OS}`);

  if (Platform.OS === 'web') {
    let delayMS = date.getTime() - Date.now();
    if (delayMS <= 0) {
      throw new Error(`oneShotAt: date is not in the future: ${date}`);
    }
    setTimeout(callback, delayMS);

  } else if (Platform.OS === 'android') {
      console.warn('android');

  } else if (Platform.OS === 'ios') {
    console.error("ios is not supported");
    throw new Error(`Platform is not supported: ${Platform.OS}`);
  } else {
    console.error(`Platform is not supported: ${Platform.OS}`);
    throw new Error(`Platform is not supported: ${Platform.OS}`);
  }
}
