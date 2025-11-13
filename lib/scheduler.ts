import { Duration, addDuration, subtractDuration } from "./timedate";
import { QuietHours } from "./quietHours";

export type NextFireDate = {
  date: Date;
  postQuiet: boolean;
};

export enum ScheduleType {
  periodic,
  random,
}

function getRandomInt(max: number) {
  return Math.floor(Math.random() * max);
}

abstract class DelegatedScheduler {
  readonly scheduleType: ScheduleType;
  readonly quietHours: QuietHours;

  scheduled: boolean = false;
  _nextDate?: NextFireDate;

  // Add some padding for alarm scheduling. This is to ensure we will schedule into the future
  readonly alarmPadding: Duration = {
    days: 0,
    hours: 0,
    minutes: 2,
    seconds: 0,
  };

  constructor(
    scheduleType: ScheduleType,
    quietHours: QuietHours,
  ) {
    this.scheduleType = scheduleType;
    this.quietHours = quietHours;
  }

  async cancel() {
    console.info("Cancelling notification schedule");

    this.quietHours.cancelTimers();
    // TimerService timerService = await getAlarmManagerTimerService();
    // await timerService.cancel(scheduleAlarmID);
  }

  queryNext(): NextFireDate {
    return this._nextDate!;
  }

  abstract getNextFireDateImpl(fromTime?: Date, adjustFromQuiet?: boolean): Date;

  getNextFireDate(fromTime?: Date): NextFireDate {
    let nextFire = this.getNextFireDateImpl(fromTime);
    let postQuiet: boolean = false;

    if (this.quietHours.isInQuietHours(nextFire)) {
      nextFire = this.getNextFireDateImpl(
        this.quietHours.getNextQuietEnd(fromTime),
        true,
      );
      postQuiet = true;
      console.info(`Scheduling next reminder, past quiet hours: ${nextFire}`);
    } else {
      console.info(`Scheduling next reminder at ${nextFire}`);
    }
    return { date: nextFire, postQuiet: postQuiet } as NextFireDate;
  }
}

export class PeriodicScheduler extends DelegatedScheduler {
  readonly durationHours: number;
  readonly durationMinutes: number; // minimum granularity: 15m

  constructor(
    quietHours: QuietHours,
    durationHours: number,
    durationMinutes: number,
  ) {
    super(ScheduleType.periodic, quietHours);
    this.durationHours = durationHours;
    this.durationMinutes = durationMinutes;
  }

  getNextFireDateImpl(fromTime?: Date, adjustFromQuiet?: boolean): Date {
    // Gets next fire time, ignoring QuietHours
    fromTime ??= new Date();
    adjustFromQuiet ??= false;
    if (!adjustFromQuiet) {
      // Add some padding for alarm scheduling.
      // This is to ensure we will schedule into the future:
      fromTime = addDuration(fromTime, this.alarmPadding);
    }

    console.log(
      `getNextFireTimeImpl: ${fromTime}, adjustFromQuiet: ${adjustFromQuiet}`,
    );

    // Algorithm:
    // - Calculate how far we are into the current interval period, relative to midnight
    // - Round up to the next interval boundary
    // - This ensures we always schedule at aligned times (e.g., on the hour, half-hour, etc.)
    // - Aligning to midnight (rather than Unix epoch) gives more predictable results:
    //   e.g., 2-hour intervals align to 0:00, 2:00, 4:00, etc. regardless of timezone

    // Calculate the total interval in milliseconds (hours + minutes)
    let totalIntervalMS: number =
      (this.durationHours * 60 + this.durationMinutes) * 60 * 1000;

    // Get midnight of the current day
    let midnight: Date = new Date(fromTime);
    midnight.setHours(0, 0, 0, 0);

    // Calculate how far we are from midnight
    let timeSinceMidnight: number = fromTime.getTime() - midnight.getTime();

    // Calculate how far we are into the current interval period (relative to midnight)
    let offsetMS: number = timeSinceMidnight % totalIntervalMS;

    let nextDate: Date;
    if (offsetMS === 0) {
      // We're exactly on a boundary
      if (adjustFromQuiet) {
        // After quiet hours, we want the NEXT interval, not the current boundary
        nextDate = addDuration(fromTime, {
          milliseconds: totalIntervalMS,
        } as Duration);
      } else {
        // Normal case: padding landed us on a boundary, use it
        nextDate = fromTime;
      }
    } else {
      // Round up to the next boundary
      let timeToNextBoundary: number = totalIntervalMS - offsetMS;
      nextDate = addDuration(fromTime, {
        milliseconds: timeToNextBoundary,
      } as Duration);
    }

    return nextDate;
  }
}

export class RandomScheduler extends DelegatedScheduler {
  readonly maxMinutes: number;
  readonly minMinutes: number;

  constructor(
    quietHours: QuietHours,
    minMinutes: number,
    maxMinutes: number,
  ) {
    super(ScheduleType.random, quietHours);
    this.minMinutes = minMinutes;
    this.maxMinutes = maxMinutes;
  }

  getNextFireDateImpl(fromTime: Date, adjustFromQuiet?: boolean): Date {
    // Gets next fire time, ignoring QuietHours
    fromTime ??= new Date();
    adjustFromQuiet ??= false;
    let nextMinutes;
    if (
      this.maxMinutes == this.minMinutes ||
      this.minMinutes > this.maxMinutes
    ) {
      if (adjustFromQuiet) {
        // For after quiet hours: pick a random time from max
        nextMinutes = getRandomInt(this.maxMinutes);
      } else {
        nextMinutes = this.maxMinutes;
      }
    } else {
      if (adjustFromQuiet) {
        // For after quiet hours: pick a random time
        nextMinutes = getRandomInt(this.maxMinutes - this.minMinutes);
      } else {
        nextMinutes =
          this.minMinutes + getRandomInt(this.maxMinutes - this.minMinutes);
      }
    }
    if (nextMinutes <= 1) {
      nextMinutes = 2;
    }
    return addDuration(fromTime, { minutes: nextMinutes } as Duration);
  }
}
