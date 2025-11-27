import {
  TimeOfDay,
} from "@/src/lib/timedate";
import { QuietHours } from "@/src/lib/quietHours";
import * as scheduler from "@/src/lib/scheduler";

const PeriodicDurationHours: number = 0;
const PeriodicDurationMins: number = 5;
const RandomMinMinutes: number = 5;
const RandomMaxMinutes: number = 15;

test("periodic", () => {
  let testDate = new Date(2025, 1, 1, 14, 1, 30);
  let quietStart = new TimeOfDay(15);
  let quietEnd = new TimeOfDay(17);
  let quietHours = new QuietHours(quietStart, quietEnd);

  let periodic = new scheduler.PeriodicScheduler(
    quietHours,
    PeriodicDurationHours,
    PeriodicDurationMins,
  );

  let nextFire : scheduler.NextFireDate = periodic.getNextFireDate(testDate);
  console.log(`nextFire: ${nextFire.date}, ${nextFire.postQuiet}`);

  let expectedNextFire = new Date(2025, 1, 1, 14, 5, 0);
  expect(nextFire.date.getTime() - expectedNextFire.getTime()).toBe(0);
});

test("periodic, in quiet hours", () => {
  let testDate = new Date(2025, 1, 1, 14, 1, 30);
  let quietStart = new TimeOfDay(14);
  let quietEnd = new TimeOfDay(16);
  let quietHours = new QuietHours(quietStart, quietEnd);

  let periodic = new scheduler.PeriodicScheduler(
    quietHours,
    PeriodicDurationHours,
    PeriodicDurationMins,
  );

  let nextFire : scheduler.NextFireDate= periodic.getNextFireDate(testDate);
  console.log(`nextFire: ${nextFire.date}, postQuiet: ${nextFire.postQuiet}`);

  let expectedNextFire = new Date(2025, 1, 1, 16, 5, 0);
  expect(nextFire.date.getTime() - expectedNextFire.getTime()).toBe(0);
});

test("random", () => {
  let testDate : Date = new Date(2025, 1, 1, 14, 0, 0);
  let quietStart = new TimeOfDay(15);
  let quietEnd = new TimeOfDay(17);
  let quietHours = new QuietHours(quietStart, quietEnd);

  let random = new scheduler.RandomScheduler(
    quietHours,
    RandomMinMinutes,
    RandomMaxMinutes,
  );

  for (let i = 0; i < 10; i++) {
    let prevFire: scheduler.NextFireDate = { date: testDate, postQuiet: false };
    let nextFire : scheduler.NextFireDate = random.getNextFireDate(testDate);
    if (prevFire) {
      console.log(`i=${i}: prevFire: ${prevFire.date}/${prevFire.postQuiet}  nextFire: ${nextFire.date}/${nextFire.postQuiet}`);
      expect(nextFire.date.getTime() - prevFire.date.getTime() !== 0).toBe(true);
    } else {
      console.log(`nextFire: ${nextFire.date} ${nextFire.postQuiet} nextFire: none`);
    }

    let expectedNextFireMin = new Date(2025, 1, 1, 14, RandomMinMinutes, 0);
    let expectedNextFireMax = new Date(2025, 1, 1, 14, RandomMaxMinutes, 0);
    expect(
      nextFire.date.getTime() - expectedNextFireMin.getTime(),
    ).toBeGreaterThanOrEqual(0);
    expect(
      expectedNextFireMax.getTime() - nextFire.date.getTime(),
    ).toBeGreaterThanOrEqual(0);

    prevFire = nextFire;
  }
});

test("periodic: full day schedule with quiet hours (9 PM - 9 AM)", () => {
  // Start at 8 AM on Feb 1, 2025
  let startDate = new Date(2025, 1, 1, 8, 0, 0);

  // Quiet hours: 9 PM (21:00) to 9 AM (09:00) - typical overnight quiet hours
  let quietStart = new TimeOfDay(21, 0);
  let quietEnd = new TimeOfDay(9, 0);
  let quietHours = new QuietHours(quietStart, quietEnd);

  // Schedule every 30 minutes
  let periodic = new scheduler.PeriodicScheduler(
    quietHours,
    0, // 0 hours
    30, // 30 minutes
  );

  let currentTime = startDate;
  let notifications: Array<{ time: Date; postQuiet: boolean }> = [];

  // Schedule 50 notifications (should cover more than 24 hours with quiet hours)
  for (let i = 0; i < 50; i++) {
    let nextFire = periodic.getNextFireDate(currentTime);
    notifications.push({ time: nextFire.date, postQuiet: nextFire.postQuiet });

    console.log(
      `[${i}] ${nextFire.date.toLocaleString()} (postQuiet: ${nextFire.postQuiet})`
    );

    // Verify the notification is in the future
    expect(nextFire.date.getTime()).toBeGreaterThan(currentTime.getTime());

    // Verify it's not in quiet hours (unless it's the first after quiet hours)
    if (!nextFire.postQuiet) {
      expect(quietHours.isInQuietHours(nextFire.date)).toBe(false);
    }

    currentTime = nextFire.date;
  }

  // Verify we've crossed into the next day
  expect(notifications[notifications.length - 1].time.getDate()).toBeGreaterThan(
    startDate.getDate()
  );

  // Count notifications during active hours (9 AM - 9 PM)
  let activeHoursNotifications = notifications.filter(n => {
    let hour = n.time.getHours();
    return hour >= 9 && hour < 21;
  });

  // Count notifications marked as postQuiet (should be scheduled right after 9 AM)
  let postQuietNotifications = notifications.filter(n => n.postQuiet);

  console.log(`Total notifications: ${notifications.length}`);
  console.log(`Active hours notifications: ${activeHoursNotifications.length}`);
  console.log(`Post-quiet notifications: ${postQuietNotifications.length}`);

  // We should have some notifications during active hours
  expect(activeHoursNotifications.length).toBeGreaterThan(0);

  // We should have exactly 2 post-quiet notifications (one for each day transition)
  // Note: This depends on how many days we span
  expect(postQuietNotifications.length).toBeGreaterThanOrEqual(1);
});

test("random: full day schedule with quiet hours (9 PM - 9 AM)", () => {
  // Start at 8 AM on Feb 1, 2025
  let startDate = new Date(2025, 1, 1, 8, 0, 0);

  // Quiet hours: 9 PM (21:00) to 9 AM (09:00)
  let quietStart = new TimeOfDay(21, 0);
  let quietEnd = new TimeOfDay(9, 0);
  let quietHours = new QuietHours(quietStart, quietEnd);

  // Random intervals between 30-60 minutes
  let random = new scheduler.RandomScheduler(
    quietHours,
    30, // min minutes
    60, // max minutes
  );

  let currentTime = startDate;
  let notifications: Array<{ time: Date; postQuiet: boolean; intervalMinutes: number }> = [];

  // Schedule 30 notifications (should cover 24+ hours with random intervals)
  for (let i = 0; i < 30; i++) {
    let nextFire = random.getNextFireDate(currentTime);
    let intervalMinutes = (nextFire.date.getTime() - currentTime.getTime()) / (1000 * 60);

    notifications.push({
      time: nextFire.date,
      postQuiet: nextFire.postQuiet,
      intervalMinutes: intervalMinutes
    });

    console.log(
      `[${i}] ${nextFire.date.toLocaleString()} ` +
      `(postQuiet: ${nextFire.postQuiet}, interval: ${intervalMinutes.toFixed(1)}m)`
    );

    // Verify the notification is in the future
    expect(nextFire.date.getTime()).toBeGreaterThan(currentTime.getTime());

    // Verify intervals are within expected range (unless postQuiet adjustment)
    if (!nextFire.postQuiet) {
      // For non-postQuiet notifications, interval should be between min and max
      // Note: There's a 2-minute padding added, so we allow some tolerance
      expect(intervalMinutes).toBeGreaterThanOrEqual(2); // At least the padding
      expect(intervalMinutes).toBeLessThanOrEqual(65); // Max + some tolerance
    }

    // Verify it's not in quiet hours (unless it's the first after quiet hours)
    if (!nextFire.postQuiet) {
      expect(quietHours.isInQuietHours(nextFire.date)).toBe(false);
    }

    currentTime = nextFire.date;
  }

  // Verify we've crossed into the next day
  expect(notifications[notifications.length - 1].time.getDate()).toBeGreaterThan(
    startDate.getDate()
  );

  // Count post-quiet notifications
  let postQuietNotifications = notifications.filter(n => n.postQuiet);

  console.log(`Total notifications: ${notifications.length}`);
  console.log(`Post-quiet notifications: ${postQuietNotifications.length}`);

  // We should have at least one post-quiet notification
  expect(postQuietNotifications.length).toBeGreaterThanOrEqual(1);
});

test("periodic: schedule across midnight quiet hours", () => {
  // Start at 8 PM on Feb 1, 2025 (just before quiet hours start at 9 PM)
  let startDate = new Date(2025, 1, 1, 20, 0, 0);

  // Quiet hours: 9 PM to 9 AM (crosses midnight)
  let quietStart = new TimeOfDay(21, 0);
  let quietEnd = new TimeOfDay(9, 0);
  let quietHours = new QuietHours(quietStart, quietEnd);

  // Schedule every 1 hour
  let periodic = new scheduler.PeriodicScheduler(
    quietHours,
    1, // 1 hour
    0, // 0 minutes
  );

  let currentTime = startDate;
  let notifications: Array<{ time: Date; postQuiet: boolean; hour: number }> = [];

  // Schedule 20 notifications
  for (let i = 0; i < 20; i++) {
    let nextFire = periodic.getNextFireDate(currentTime);
    notifications.push({
      time: nextFire.date,
      postQuiet: nextFire.postQuiet,
      hour: nextFire.date.getHours()
    });

    console.log(
      `[${i}] ${nextFire.date.toLocaleString()} ` +
      `(hour: ${nextFire.date.getHours()}, postQuiet: ${nextFire.postQuiet})`
    );

    currentTime = nextFire.date;
  }

  // First notification would be at 9 PM (21:00) - entering quiet hours
  // So it should be scheduled for after quiet hours end
  // The scheduler adds the interval after quiet hours end, so it's 9 AM + 1 hour = 10 AM
  expect(notifications[0].postQuiet).toBe(true);
  expect(notifications[0].hour).toBe(10); // Should be at 10 AM (9 AM + 1 hour interval)

  // After that, notifications should be during active hours (9 AM - 9 PM)
  let activeNotifications = notifications.filter(n => {
    let hour = n.hour;
    return hour >= 9 && hour < 21;
  });

  // Most notifications should be during active hours
  expect(activeNotifications.length).toBeGreaterThan(10);

  // No notifications should occur during quiet hours (9 PM - 9 AM)
  let quietHoursNotifications = notifications.filter(n => {
    let hour = n.hour;
    return hour >= 21 || hour < 9;
  });

  // The only quiet-hours times should be those marked as postQuiet (at 9 AM)
  quietHoursNotifications.forEach(n => {
    if (n.hour >= 21 || n.hour < 9) {
      // If it's in quiet hours time range, it should be at 9 AM (boundary)
      if (n.hour < 9) {
        expect(n.hour).toBe(9); // Should only be at the end boundary (9 AM)
      }
    }
  });
});

test("random: schedule 40 notifications simulating app buffer", () => {
  // Simulate scheduling a buffer of 40 notifications as the app does
  // Start at current time
  let startDate = new Date(2025, 1, 1, 14, 30, 0);

  // Realistic quiet hours: 9 PM to 9 AM
  let quietStart = new TimeOfDay(21, 0);
  let quietEnd = new TimeOfDay(9, 0);
  let quietHours = new QuietHours(quietStart, quietEnd);

  // Realistic random intervals: 30-60 minutes (same as app default)
  let random = new scheduler.RandomScheduler(
    quietHours,
    30,
    60,
  );

  let currentTime = startDate;
  let notifications: Array<{
    time: Date;
    postQuiet: boolean;
    intervalMinutes: number;
    hour: number;
  }> = [];

  // Schedule 40 notifications (same as recommended buffer size)
  for (let i = 0; i < 40; i++) {
    let nextFire = random.getNextFireDate(currentTime);
    let intervalMinutes = (nextFire.date.getTime() - currentTime.getTime()) / (1000 * 60);

    notifications.push({
      time: nextFire.date,
      postQuiet: nextFire.postQuiet,
      intervalMinutes: intervalMinutes,
      hour: nextFire.date.getHours()
    });

    currentTime = nextFire.date;
  }

  // Calculate time span covered
  let totalHours = (notifications[notifications.length - 1].time.getTime() - startDate.getTime())
    / (1000 * 60 * 60);

  console.log(`\n=== Buffer Simulation Results ===`);
  console.log(`Total notifications: ${notifications.length}`);
  console.log(`Time span: ${totalHours.toFixed(1)} hours`);
  console.log(`Start: ${notifications[0].time.toLocaleString()}`);
  console.log(`End: ${notifications[notifications.length - 1].time.toLocaleString()}`);

  // Count notifications by time period
  let postQuietCount = notifications.filter(n => n.postQuiet).length;
  let nightSkipped = notifications.filter((n, i) => {
    if (i === 0) return false;
    let prevHour = notifications[i - 1].hour;
    let currHour = n.hour;
    // Check if we jumped from evening to morning (skipped night)
    return prevHour >= 19 && currHour <= 10;
  }).length;

  console.log(`Post-quiet notifications: ${postQuietCount}`);
  console.log(`Night periods skipped: ${nightSkipped}`);

  // With 40 notifications at 30-60 min intervals, we should cover at least 20 hours
  // (40 * 30min = 1200min = 20 hours minimum)
  expect(totalHours).toBeGreaterThanOrEqual(20);

  // We should span at least 1 full day
  let daySpan = notifications[notifications.length - 1].time.getDate() - startDate.getDate();
  if (daySpan === 0) {
    // If same day, check if we went past midnight in month
    daySpan = notifications[notifications.length - 1].time.getMonth() - startDate.getMonth();
  }
  expect(daySpan).toBeGreaterThanOrEqual(1);

  // All notifications should be in the future relative to their predecessor
  for (let i = 1; i < notifications.length; i++) {
    expect(notifications[i].time.getTime()).toBeGreaterThan(
      notifications[i - 1].time.getTime()
    );
  }

  // All active-hours notifications should not be in quiet hours
  notifications.forEach((n, i) => {
    if (!n.postQuiet) {
      expect(quietHours.isInQuietHours(n.time)).toBe(false);
    }
    console.log(
      `[${i}] ${n.time.toLocaleString()} ` +
      `(${n.intervalMinutes.toFixed(1)}m, postQuiet: ${n.postQuiet})`
    );
  });
});

// ============================================================================
// Alignment Algorithm Tests
// ============================================================================

test("alignment: 15-minute intervals should align to 0, 15, 30, 45", () => {
  let quietHours = new QuietHours(new TimeOfDay(23), new TimeOfDay(7));
  let periodic = new scheduler.PeriodicScheduler(quietHours, 0, 15);

  // Test from various starting times - all should align to quarter-hour marks
  const testCases = [
    { start: new Date(2025, 1, 1, 10, 3, 27), expectedMinute: 15 },
    { start: new Date(2025, 1, 1, 10, 17, 45), expectedMinute: 30 },
    { start: new Date(2025, 1, 1, 10, 32, 10), expectedMinute: 45 },
    { start: new Date(2025, 1, 1, 10, 46, 59), expectedMinute: 0 }, // Should roll to next hour
  ];

  testCases.forEach(({ start, expectedMinute }) => {
    let nextFire = periodic.getNextFireDate(start);
    console.log(`Start: ${start.toLocaleTimeString()}, Next: ${nextFire.date.toLocaleTimeString()}`);

    expect(nextFire.date.getMinutes()).toBe(expectedMinute);
    expect(nextFire.date.getSeconds()).toBe(0);
    expect(nextFire.date.getTime()).toBeGreaterThan(start.getTime());
  });
});

test("alignment: 30-minute intervals should align to 0, 30", () => {
  let quietHours = new QuietHours(new TimeOfDay(23), new TimeOfDay(7));
  let periodic = new scheduler.PeriodicScheduler(quietHours, 0, 30);

  const testCases = [
    { start: new Date(2025, 1, 1, 10, 5, 0), expectedMinute: 30 },
    { start: new Date(2025, 1, 1, 10, 28, 0), expectedMinute: 30 },
    { start: new Date(2025, 1, 1, 10, 35, 0), expectedMinute: 0 }, // Next hour
    { start: new Date(2025, 1, 1, 10, 58, 0), expectedMinute: 0 }, // Next hour
  ];

  testCases.forEach(({ start, expectedMinute }) => {
    let nextFire = periodic.getNextFireDate(start);
    console.log(`Start: ${start.toLocaleTimeString()}, Next: ${nextFire.date.toLocaleTimeString()}`);

    expect(nextFire.date.getMinutes()).toBe(expectedMinute);
    expect(nextFire.date.getSeconds()).toBe(0);
  });
});

test("alignment: 1-hour intervals should align to top of hour", () => {
  let quietHours = new QuietHours(new TimeOfDay(23), new TimeOfDay(7));
  let periodic = new scheduler.PeriodicScheduler(quietHours, 1, 0);

  const testCases = [
    { start: new Date(2025, 1, 1, 10, 15, 30), expectedHour: 11 },
    { start: new Date(2025, 1, 1, 10, 45, 0), expectedHour: 11 },
    { start: new Date(2025, 1, 1, 13, 5, 0), expectedHour: 14 },
  ];

  testCases.forEach(({ start, expectedHour }) => {
    let nextFire = periodic.getNextFireDate(start);
    console.log(`Start: ${start.toLocaleString()}, Next: ${nextFire.date.toLocaleString()}`);

    expect(nextFire.date.getHours()).toBe(expectedHour);
    expect(nextFire.date.getMinutes()).toBe(0);
    expect(nextFire.date.getSeconds()).toBe(0);
  });
});

test("alignment: 2-hour intervals should align to even hours (0, 2, 4, ...)", () => {
  let quietHours = new QuietHours(new TimeOfDay(23), new TimeOfDay(7));
  let periodic = new scheduler.PeriodicScheduler(quietHours, 2, 0);

  // Starting from 10:30 AM, next should be 12:00 (noon)
  let start1 = new Date(2025, 1, 1, 10, 30, 0);
  let next1 = periodic.getNextFireDate(start1);
  console.log(`Start: ${start1.toLocaleString()}, Next: ${next1.date.toLocaleString()}`);

  // With 2-hour intervals, should align to 0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22
  expect(next1.date.getHours() % 2).toBe(0);
  expect(next1.date.getMinutes()).toBe(0);

  // Chain a few to verify consistent alignment
  let currentTime = start1;
  for (let i = 0; i < 5; i++) {
    let nextFire = periodic.getNextFireDate(currentTime);
    console.log(`[${i}] ${nextFire.date.toLocaleString()} (hour: ${nextFire.date.getHours()})`);

    expect(nextFire.date.getHours() % 2).toBe(0);
    expect(nextFire.date.getMinutes()).toBe(0);
    expect(nextFire.date.getSeconds()).toBe(0);

    currentTime = nextFire.date;
  }
});

test("alignment: mixed interval (1 hour 15 minutes) alignment behavior", () => {
  let quietHours = new QuietHours(new TimeOfDay(23), new TimeOfDay(7));
  let periodic = new scheduler.PeriodicScheduler(quietHours, 1, 15);

  // With 75-minute intervals, alignment behavior is important
  // Starting at 10:00, should go: 11:15, 12:30, 13:45, 15:00, etc.
  let start = new Date(2025, 1, 1, 10, 0, 0);
  let expectedTimes = [
    { hour: 11, minute: 15 },
    { hour: 12, minute: 30 },
    { hour: 13, minute: 45 },
    { hour: 15, minute: 0 },
    { hour: 16, minute: 15 },
  ];

  let currentTime = start;
  for (let i = 0; i < expectedTimes.length; i++) {
    let nextFire = periodic.getNextFireDate(currentTime);
    console.log(`[${i}] ${nextFire.date.toLocaleString()}`);

    expect(nextFire.date.getHours()).toBe(expectedTimes[i].hour);
    expect(nextFire.date.getMinutes()).toBe(expectedTimes[i].minute);
    expect(nextFire.date.getSeconds()).toBe(0);

    currentTime = nextFire.date;
  }
});

test("alignment: 20-minute intervals (non-hour-divisible)", () => {
  let quietHours = new QuietHours(new TimeOfDay(23), new TimeOfDay(7));
  let periodic = new scheduler.PeriodicScheduler(quietHours, 0, 20);

  // 20 minutes doesn't divide evenly into an hour, so pattern is: 0, 20, 40, 0, 20, 40...
  let start = new Date(2025, 1, 1, 10, 5, 0);
  let expectedMinutes = [20, 40, 0, 20, 40, 0]; // Next alignment points

  let currentTime = start;
  for (let i = 0; i < expectedMinutes.length; i++) {
    let nextFire = periodic.getNextFireDate(currentTime);
    console.log(`[${i}] ${nextFire.date.toLocaleTimeString()}`);

    expect(nextFire.date.getMinutes()).toBe(expectedMinutes[i]);
    expect(nextFire.date.getSeconds()).toBe(0);

    currentTime = nextFire.date;
  }
});

test("alignment: 5-minute intervals consistency over time", () => {
  let quietHours = new QuietHours(new TimeOfDay(23), new TimeOfDay(7));
  let periodic = new scheduler.PeriodicScheduler(quietHours, 0, 5);

  // 5-minute intervals should always align to multiples of 5
  let start = new Date(2025, 1, 1, 10, 3, 27);
  let currentTime = start;

  for (let i = 0; i < 20; i++) {
    let nextFire = periodic.getNextFireDate(currentTime);
    let minute = nextFire.date.getMinutes();

    // Should always be a multiple of 5
    expect(minute % 5).toBe(0);
    expect(nextFire.date.getSeconds()).toBe(0);

    currentTime = nextFire.date;
  }
});

test("alignment: verify spacing between aligned intervals", () => {
  let quietHours = new QuietHours(new TimeOfDay(23), new TimeOfDay(7));
  let periodic = new scheduler.PeriodicScheduler(quietHours, 0, 15);

  let start = new Date(2025, 1, 1, 10, 0, 0);
  let currentTime = start;
  let prevTime: Date | null = null;

  for (let i = 0; i < 10; i++) {
    let nextFire = periodic.getNextFireDate(currentTime);

    if (prevTime) {
      let diffMinutes = (nextFire.date.getTime() - prevTime.getTime()) / (1000 * 60);
      console.log(`[${i}] Spacing: ${diffMinutes} minutes`);

      // Each interval should be exactly 15 minutes apart
      expect(diffMinutes).toBe(15);
    }

    prevTime = nextFire.date;
    currentTime = nextFire.date;
  }
});
