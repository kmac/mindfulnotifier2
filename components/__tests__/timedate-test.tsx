import { Duration, addDuration, subtractDuration } from "../timedate";

test("very basic", () => {
  let duration: Duration = { hours: 3, minutes: 0, seconds: 0 };
  expect(duration.days).toBe(undefined);
  expect(duration.hours).toBe(3);
});

test("Add duration basic", () => {
  // let duration: Duration = { days: 0, hours: 3, minutes: 0, seconds: 0 };
  let duration: Duration = { hours: 3 };
  let currentDate: Date = new Date();
  let currentDateMS: number = currentDate.getTime();
  expect(addDuration(currentDate, duration).getTime()).toBe(
    currentDateMS + 3 * 60 * 60 * 1000,
  );
});

test("Subtract duration basic", () => {
  let duration: Duration = { hours: 3 };
  let currentDate: Date = new Date();
  let currentDateMS: number = currentDate.getTime();
  expect(subtractDuration(currentDate, duration).getTime()).toBe(
    currentDateMS - 3 * 60 * 60 * 1000,
  );
});
