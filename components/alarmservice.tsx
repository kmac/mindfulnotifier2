// import * as Device from 'expo-device';
import { Platform } from 'react-native';

export function getAlarmService() : AlarmService {
  if (Platform.OS === 'web') {
    return new WebAlarmService();
  } else if (Platform.OS === 'android') {
    return new AndroidAlarmService();
  } else if (Platform.OS === 'ios') {
    console.error("ios is not supported");
  } else {
    console.error(`Platform is not supported: ${Platform.OS}`);
  }
  throw new Error(`Platform is not supported: ${Platform.OS}`);
}

export abstract class AlarmService {
  running: boolean = false;

  constructor() {}

  initialize() {}

  enable() {}

  disable() {}

  shutdown() {}
}

export class WebAlarmService extends AlarmService {
  constructor() {
    super();
  }
}

export class AndroidAlarmService extends AlarmService {
  constructor() {
    super();
  }
}
