import {
  Duration,
  TimeOfDay,
  addDuration,
  subtractDuration,
  convertTimeOfDayToToday,
  convertTimeOfDayToTomorrow,
  convertTimeOfDayToYesterday,
} from "@/components/timedate";

export class QuietHours {
  readonly startTime: TimeOfDay;
  readonly endTime: TimeOfDay;
  readonly notifyQuietHours: boolean = false;

  constructor(
    startTime: TimeOfDay,
    endTime: TimeOfDay,
    notifyQuietHours?: boolean,
  ) {
    this.startTime = startTime;
    this.endTime = endTime;
    if (notifyQuietHours !== undefined) {
      this.notifyQuietHours = notifyQuietHours;
    }
  }

  defaultQuietHours() {
    return new QuietHours(new TimeOfDay(21, 0), new TimeOfDay(9, 0));
  }

  getNextQuietStart(current?: Date): Date {
    current ??= new Date();
    let quietStart: Date = convertTimeOfDayToToday(this.startTime, current);
    if (quietStart < current) {
      quietStart = convertTimeOfDayToTomorrow(this.startTime, current);
    }
    return quietStart;
  }

  getNextQuietEnd(current?: Date): Date {
    current ??= new Date();
    let quietEnd: Date = convertTimeOfDayToToday(this.endTime, current);
    if (quietEnd < current) {
      quietEnd = convertTimeOfDayToTomorrow(this.endTime, current);
    }
    return quietEnd;
  }

  isInQuietHours(givenDate: Date): boolean {
    // /*
    //      yesterday ???   today     ???     tomorrow  ???
    //     ---------------------------------------------------------------
    //           now1              now2                now3 (same as now1)
    //            V                 V                   V
    //     ----------------|---------------------|-------------
    //                 quiet start            quiet end
    //               (past or future)      (ALWAYS IN THE FUTURE)
    //
    //   Quiet end is always in the future.
    //   Quiet start may be in the past (only when in quiet hours) or future.
    //   Therefore, we can start from the end and work our way back.
    // */
    // // Note: 'today' and 'tomorrow' are all relative to the date we're given.
    let todayEnd: Date = convertTimeOfDayToToday(this.endTime, givenDate);
    let tomorrowEnd: Date = convertTimeOfDayToTomorrow(this.endTime, givenDate);
    let todayStart: Date = convertTimeOfDayToToday(this.startTime, givenDate);
    //
    // Is quiet end today or tomorrow? It is always in the future.
    let end: Date;
    if (givenDate < todayEnd) {
      end = todayEnd;
    } else {
      end = tomorrowEnd;
    }
    console.assert(givenDate < end, "new quiet hours is not in future");

    // Now we can base quiet start on what we know to be the end
    // Adjust today's start if necessary (for instance, if it is just after midnight)
    //if (todayStart.add(Duration(days: 1)).isBefore(end)) {
    if (addDuration(todayStart, { days: 1 }) < end) {
      todayStart = addDuration(todayStart, { days: 1 });
    }

    if (todayStart > end) {
      // Today's start is after today's end, but we haven't reached
      // today's end yet (see above end calculation), which must mean that:
      // 1) quiet hours started _yesterday_, and
      // 2) we must be in quiet hours, since we haven't reached today's end yet.
      let yesterdayStart = convertTimeOfDayToYesterday(
        this.startTime,
        givenDate,
      );
      console.assert(givenDate > yesterdayStart);
      console.assert(givenDate < end);
      console.assert(givenDate < todayStart);
      return true;
    }

    // Now we know that we are before 'end' (which is either today or
    // tomorrow - we don't care, because it is somewhere in the future).
    // So, if we are before today's start then we're before quiet hours;
    // otherwise we are in quiet hours.
    if (givenDate < todayStart) {
      return false;
    }
    return true;
  }

  async initializeTimers() {
    // if (isInQuietHours(DateTime.now())) {
    //   quietStart();
    // }
    // var nextQuietStart = getNextQuietStart();
    // var nextQuietEnd = getNextQuietEnd();
    // TimerService timerService = await getAlarmManagerTimerService();
    // await timerService.cancel(quietHoursStartAlarmID);
    // // await timerService.cancel(quietHoursEndAlarmID);
    // logger.i(
    //     "Initializing quiet hours timers, start=$nextQuietStart, end=$nextQuietEnd");
    // assert(nextQuietStart.isAfter(DateTime.now()));
    // await timerService.oneShotAt(
    //     nextQuietStart, quietHoursStartAlarmID, quietHoursStartCallback);
  }

  async cancelTimers() {
    // logger.i("Cancelling quiet hours timers");
    // TimerService timerService = await getAlarmManagerTimerService();
    // await timerService.cancel(quietHoursStartAlarmID);
  }

  async quietStart() {
    // logger.i("Quiet hours start");
    // Scheduler scheduler = await Scheduler.getScheduler();
    // scheduler.sendReminderMessage(constants.reminderMessageQuietHours);
    // if (notifyQuietHours) {
    //   Notifier().showQuietHoursNotification(true);
    // }
  }
}
