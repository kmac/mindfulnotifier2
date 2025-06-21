import {
  Duration,
  TimeOfDay,
  addDuration,
  subtractDuration,
} from "../timedate";
import { Controller } from "../controller";
import { QuietHours } from "../quiethours";
import * as scheduler from "../scheduler";

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
