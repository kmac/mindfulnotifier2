const OneMinuteMS = 60 * 1000;
const OneHourMS = 60 * OneMinuteMS;
const OneDayMS = 24 * OneHourMS;

export type Duration = {
  days?: number;
  hours?: number;
  minutes?: number;
  seconds?: number;
  milliseconds?: number;
};

export function addDuration(date: Date, duration: Duration) {
  let newDateMsec: number = date.getTime();
  if (duration.days) {
    newDateMsec += duration.days * OneDayMS;
  }
  if (duration.hours) {
    newDateMsec += duration.hours * OneHourMS;
  }
  if (duration.minutes) {
    newDateMsec += duration.minutes * OneMinuteMS;
  }
  if (duration.seconds) {
    newDateMsec += duration.seconds * 1000;
  }
  if (duration.milliseconds) {
    newDateMsec += duration.milliseconds;
  }
  return new Date(newDateMsec);
}

export function subtractDuration(date: Date, duration: Duration) {
  let newDateMsec: number = date.getTime();
  if (duration.days) {
    newDateMsec -= duration.days * OneDayMS;
  }
  if (duration.hours) {
    newDateMsec -= duration.hours * OneHourMS;
  }
  if (duration.minutes) {
    newDateMsec -= duration.minutes * OneMinuteMS;
  }
  if (duration.seconds) {
    newDateMsec -= duration.seconds * 1000;
  }
  if (duration.milliseconds) {
    newDateMsec -= duration.milliseconds;
  }
  return new Date(newDateMsec);
}

export class TimeOfDay {
  /* modified from https://stackoverflow.com/a/74085130

     const t1 = new Time(4, 30)
     const t2 = new Time(1, 15)
     const t3 = new Time(t1.getTime() - t2.getTime())
     t3.getHours() // 3
     t3.getMinutes() // 15

     Note: hours are stored as UTC but that is just for proper date calculations
  */
  private date: Date;

  constructor(hours: number, minutes: number = 0, seconds: number = 0) {
    this.date = new Date(Date.UTC(1970, 0, 1, hours, minutes, seconds));
  }

  getHours() {
    return this.date.getUTCHours();
  }

  getMinutes() {
    return this.date.getUTCMinutes();
  }

  getSeconds() {
    return this.date.getUTCSeconds();
  }

  getTime() {
    return this.date.getTime();
  }

  toStringShort() {
    return `${this.getHours().toString().padStart(2, "0")}:${this.getMinutes().toString().padStart(2, "0")}`;
  }

  toString() {
    return `${this.getHours().toString().padStart(2, "0")}:${this.getMinutes().toString().padStart(2, "0")}:${this.getSeconds().toString().padStart(2, "0")}`;
  }
}

export function convertTimeOfDayToToday(time: TimeOfDay, current?: Date): Date {
  // Converts given dates time-of-day parameters to today
  let today = current ? new Date(current) : new Date();
  today.setHours(time.getHours(), time.getMinutes(), time.getSeconds(), 0);
  return today;
}

export function convertTimeOfDayToTomorrow(
  time: TimeOfDay,
  current?: Date,
): Date {
  let today: Date = convertTimeOfDayToToday(time, current);
  let tomorrowMS = today.getTime() + OneDayMS;
  return new Date(tomorrowMS);
}

export function convertTimeOfDayToYesterday(
  time: TimeOfDay,
  current?: Date,
): Date {
  let today: Date = convertTimeOfDayToToday(time, current);
  let yesterdayMS = today.getTime() - OneDayMS;
  return new Date(yesterdayMS);
}
