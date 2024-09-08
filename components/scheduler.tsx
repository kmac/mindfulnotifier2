import { Duration, addDuration, subtractDuration } from "@/components/timedate";
import { QuietHours } from "@/components/quiethours";

export type NextFireDate = {
  date: Date;
  postQuiet: boolean;
};

function getRandomInt(max: number) {
  return Math.floor(Math.random() * max);
}

export class Scheduler {
  running: boolean = false;

  constructor() {}

  enable(restart: boolean = false) {
    console.info(`Scheduler enable, restart=${restart}`);
  }

  shutdown() {
    console.info("Scheduler shutdown");
  }

  initialScheduleComplete() {
    console.info("Scheduler initialScheduleComplete");
  }
}

export enum ScheduleType {
  periodic,
  random,
}

abstract class DelegatedScheduler {
  readonly scheduleType: ScheduleType;
  readonly scheduler: Scheduler;
  readonly quietHours: QuietHours;

  scheduled: boolean = false;
  _nextDate?: Date;

  // Add some padding for alarm scheduling. This is to ensure we will schedule into the future
  readonly alarmPadding: Duration = {
    days: 0,
    hours: 0,
    minutes: 2,
    seconds: 0,
  };

  constructor(
    scheduleType: ScheduleType,
    scheduler: Scheduler,
    quietHours: QuietHours,
  ) {
    this.scheduleType = scheduleType;
    this.scheduler = scheduler;
    this.quietHours = quietHours;
  }

  async cancel() {
    console.info("Cancelling notification schedule ${getCurrentIsolate()}");
    this.quietHours.cancelTimers();
    // TimerService timerService = await getAlarmManagerTimerService();
    // await timerService.cancel(scheduleAlarmID);
  }

  queryNext(): Date {
    return this._nextDate!;
  }

  abstract getNextFireDateImpl(fromTime: Date, adjustFromQuiet?: boolean): Date;

  getNextFireDate(fromTime: Date): NextFireDate {
    let nextFire = this.getNextFireDateImpl(fromTime);
    let postQuiet: boolean = false;

    if (this.quietHours.isInQuietHours(nextFire)) {
      nextFire = this.getNextFireDateImpl(
        this.quietHours.getNextQuietEnd(fromTime),
        true,
      );
      postQuiet = true;
      console.info(`Scheduling next reminder, past quiet hours: ${nextFire}`);
      // scheduler.sendInfoMessage(
      //     "${constants.reminderMessageQuietHours}, next reminder at ${formatHHMMSS(_nextDate!)}");
    } else {
      console.info(`Scheduling next reminder at ${nextFire}`);
      // scheduler.sendInfoMessage("Next reminder at ${formatHHMMSS(_nextDate!)}");
    }
    return { date: nextFire, postQuiet: postQuiet } as NextFireDate;
  }

  async scheduleNext(restart: boolean = false) {
    console.debug(`Scheduling next notification, type=${this.scheduleType}`);

    this._nextDate = undefined;
    // if (restart) {
    //   // use nextAlarm if possible; otherwise it gets left null
    //   nextAlarmStr :String = this.scheduler.ds!.nextAlarm;
    //   if (this.nextAlarmStr != '') {
    //     nextAlarm : Date= DateTime.parse(scheduler.ds!.nextAlarm);
    //     if (this.nextAlarm.isAfter(Date.now().add(Duration(seconds: 10)))) {
    //       console.info("Re-scheduling based on nextAlarm $nextAlarmStr");
    //       _nextDate = nextAlarm;
    //     }
    //   }
    // }
    // _nextDate ??= getNextFireTime();
    //
    // if (rescheduleAfterQuietHours && quietHours.isInQuietHours(_nextDate!)) {
    //   _nextDate = getNextFireTime(
    //       fromTime: quietHours.getNextQuietEnd(), adjustFromQuiet: true);
    //   console.info("Scheduling next reminder, past quiet hours: $_nextDate");
    //   scheduler.sendInfoMessage(
    //       "${constants.reminderMessageQuietHours}, next reminder at ${formatHHMMSS(_nextDate!)}");
    // } else {
    //   console.info("Scheduling next reminder at $_nextDate");
    //   scheduler.sendInfoMessage("Next reminder at ${formatHHMMSS(_nextDate!)}");
    // }
    //
    // TimerService timerService = await getAlarmManagerTimerService();
    // timerService.oneShotAt(_nextDate!, scheduleAlarmID, scheduleCallback);
    // scheduler.updateDS(
    //     ScheduleDataStoreBase.nextAlarmKey, _nextDate!.toIso8601String(),
    //     sendUpdate: true);
    //
    // if (!scheduled) {
    //   initialScheduleComplete();
    // }
  }

  initialScheduleComplete() {
    this.scheduler.initialScheduleComplete();
  }
}

export class PeriodicScheduler extends DelegatedScheduler {
  readonly durationHours: number;
  readonly durationMinutes: number; // minimum granularity: 15m

  constructor(
    scheduler: Scheduler,
    quietHours: QuietHours,
    durationHours: number,
    durationMinutes: number,
  ) {
    super(ScheduleType.periodic, scheduler, quietHours);
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
    // - add hours and minutes.
    // - align to next interval
    // Number of msec from now = intervalMsecs - (nextDateRawEpochMsec MOD intervalMsecs)

    // nextFireTimeMsec = (timenowMsec + intervalMsec) MOD intervalMsec
    // nextFireTimeMsec = timenowMsec+intervalMsec + timenowMsec ~/ intervalMsec - (timenowMsec % intervalMsec)

    //       now           interval             now+interval
    //        |  ----------------------------->  |
    //                                  |
    // -----------------------------------------------------------------------
    //                              alignment
    //
    /*
    How to calculate 'alignment'?
    - subract out the hours component
    - how many 'interval minutes' fit in an hour?
        - is it even?  then align to top of hour
        - if it doesn't fit evenly, then just pick next interval (don't align)
    */

    // Add interval hours:
    let nextDateRaw: Date = addDuration(fromTime, {
      hours: this.durationHours,
    } as Duration);

    // Add interval minutes:
    let intervalMins: Duration = { minutes: this.durationMinutes };

    nextDateRaw = addDuration(nextDateRaw, intervalMins);

    // Now bring it back to the start of the interval:
    let minutesOverMS: number =
      nextDateRaw.getTime() % (this.durationMinutes * 60 * 1000);

    let nextDate: Date = subtractDuration(nextDateRaw, {
      milliseconds: minutesOverMS,
    } as Duration);

    return nextDate;
  }
}

export class RandomScheduler extends DelegatedScheduler {
  readonly maxMinutes: number;
  readonly minMinutes: number;

  constructor(
    scheduler: Scheduler,
    quietHours: QuietHours,
    minMinutes: number,
    maxMinutes: number,
  ) {
    super(ScheduleType.random, scheduler, quietHours);
    this.minMinutes = minMinutes;
    this.maxMinutes = maxMinutes;
  }

  initialScheduleComplete() {
    this.scheduler.initialScheduleComplete();
    this.scheduled = true;
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
