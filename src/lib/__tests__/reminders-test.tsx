import {
  DEFAULT_FAVOURITE_SELECTION_PROBABILITY,
  JsonReminder,
} from "@/src/constants/Reminders";

import { getRandomReminder, getShuffledReminders } from "@/src/lib/reminders";

// Test fixtures
const createReminder = (
  text: string,
  enabled: boolean = true,
  favourite: boolean = false,
): JsonReminder => ({
  text,
  enabled,
  tag: "test",
  favourite,
});

const mixedReminders: JsonReminder[] = [
  createReminder("fav1", true, true),
  createReminder("fav2", true, true),
  createReminder("normal1", true, false),
  createReminder("normal2", true, false),
  createReminder("normal3", true, false),
];

const allFavourites: JsonReminder[] = [
  createReminder("fav1", true, true),
  createReminder("fav2", true, true),
  createReminder("fav3", true, true),
];

const noFavourites: JsonReminder[] = [
  createReminder("normal1", true, false),
  createReminder("normal2", true, false),
  createReminder("normal3", true, false),
];

const mixedWithDisabled: JsonReminder[] = [
  createReminder("fav1", true, true),
  createReminder("fav2-disabled", false, true),
  createReminder("normal1", true, false),
  createReminder("normal2-disabled", false, false),
];

describe("getRandomReminder", () => {
  describe("basic functionality", () => {
    test("returns a string from the reminders list", () => {
      const result = getRandomReminder(mixedReminders);
      const allTexts = mixedReminders.map((r) => r.text);
      expect(allTexts).toContain(result);
    });

    test("only returns enabled reminders", () => {
      // Run multiple times to increase confidence
      for (let i = 0; i < 50; i++) {
        const result = getRandomReminder(mixedWithDisabled);
        expect(result).not.toBe("fav2-disabled");
        expect(result).not.toBe("normal2-disabled");
      }
    });

    test("falls back to all reminders if none are enabled", () => {
      const allDisabled = [
        createReminder("disabled1", false, false),
        createReminder("disabled2", false, true),
      ];
      const result = getRandomReminder(allDisabled);
      expect(["disabled1", "disabled2"]).toContain(result);
    });
  });

  describe("favouriteSelectionProbability = 0 (no prioritization)", () => {
    test("can return both favourites and non-favourites", () => {
      const results = new Set<string>();
      // Run many times to get a good sample
      for (let i = 0; i < 100; i++) {
        results.add(getRandomReminder(mixedReminders, 0));
      }
      // Should have results from both pools
      const hasFavourite = results.has("fav1") || results.has("fav2");
      const hasNormal =
        results.has("normal1") ||
        results.has("normal2") ||
        results.has("normal3");
      expect(hasFavourite).toBe(true);
      expect(hasNormal).toBe(true);
    });

    test("treats all reminders equally regardless of favourite status", () => {
      // With probability 0, we should see roughly equal distribution
      const counts: Record<string, number> = {};
      const iterations = 1000;

      for (let i = 0; i < iterations; i++) {
        const result = getRandomReminder(mixedReminders, 0);
        counts[result] = (counts[result] || 0) + 1;
      }

      // Each reminder should appear roughly 20% of the time (1/5)
      // Allow for statistical variance (10-30%)
      for (const reminder of mixedReminders) {
        const percentage = (counts[reminder.text] || 0) / iterations;
        expect(percentage).toBeGreaterThan(0.1);
        expect(percentage).toBeLessThan(0.35);
      }
    });
  });

  describe("favouriteSelectionProbability = 1 (always prioritize favourites)", () => {
    test("only returns favourites when they exist", () => {
      for (let i = 0; i < 50; i++) {
        const result = getRandomReminder(mixedReminders, 1);
        expect(["fav1", "fav2"]).toContain(result);
      }
    });

    test("returns from all reminders when no favourites exist", () => {
      const results = new Set<string>();
      for (let i = 0; i < 50; i++) {
        results.add(getRandomReminder(noFavourites, 1));
      }
      // Should still return reminders even with probability 1 and no favourites
      expect(results.size).toBeGreaterThan(0);
    });

    test("returns favourites when all are favourites", () => {
      const result = getRandomReminder(allFavourites, 1);
      expect(["fav1", "fav2", "fav3"]).toContain(result);
    });
  });

  describe("favouriteSelectionProbability = 0.2 (default)", () => {
    test("default probability constant is 0.2", () => {
      expect(DEFAULT_FAVOURITE_SELECTION_PROBABILITY).toBe(0.2);
    });

    test("returns mix of favourites and non-favourites over many iterations", () => {
      const favouriteCount = { fav: 0, normal: 0 };
      const iterations = 1000;

      for (let i = 0; i < iterations; i++) {
        const result = getRandomReminder(mixedReminders, 0.2);
        if (result.startsWith("fav")) {
          favouriteCount.fav++;
        } else {
          favouriteCount.normal++;
        }
      }

      // With 20% probability, favourites should appear roughly 20% of the time
      // Allow for statistical variance (12-42%)
      const favPercentage = favouriteCount.fav / iterations;
      expect(favPercentage).toBeGreaterThan(0.12);
      expect(favPercentage).toBeLessThan(0.42);
    });
  });

  describe("edge cases", () => {
    test("handles single reminder", () => {
      const single = [createReminder("only", true, true)];
      expect(getRandomReminder(single)).toBe("only");
    });

    test("handles single favourite with no non-favourites", () => {
      const single = [createReminder("only-fav", true, true)];
      expect(getRandomReminder(single, 0.5)).toBe("only-fav");
    });

    test("handles single non-favourite with no favourites", () => {
      const single = [createReminder("only-normal", true, false)];
      expect(getRandomReminder(single, 0.5)).toBe("only-normal");
    });
  });
});

describe("getShuffledReminders", () => {
  describe("basic functionality", () => {
    test("returns requested number of reminders", () => {
      const result = getShuffledReminders(5, mixedReminders);
      expect(result).toHaveLength(5);
    });

    test("returns more reminders than available by repeating", () => {
      const result = getShuffledReminders(10, mixedReminders);
      expect(result).toHaveLength(10);
    });

    test("only returns enabled reminders", () => {
      const results = getShuffledReminders(50, mixedWithDisabled);
      for (const result of results) {
        expect(result).not.toBe("fav2-disabled");
        expect(result).not.toBe("normal2-disabled");
      }
    });
  });

  describe("favouriteSelectionProbability = 0 (no prioritization)", () => {
    test("returns both favourites and non-favourites", () => {
      const results = getShuffledReminders(100, mixedReminders, 0);
      const hasFavourite = results.some((r) => r.startsWith("fav"));
      const hasNormal = results.some((r) => r.startsWith("normal"));
      expect(hasFavourite).toBe(true);
      expect(hasNormal).toBe(true);
    });

    test("distributes roughly equally across all reminders", () => {
      const results = getShuffledReminders(500, mixedReminders, 0);
      const counts: Record<string, number> = {};

      for (const result of results) {
        counts[result] = (counts[result] || 0) + 1;
      }

      // Each reminder should appear roughly 20% of the time
      for (const reminder of mixedReminders) {
        const percentage = (counts[reminder.text] || 0) / results.length;
        expect(percentage).toBeGreaterThan(0.1);
        expect(percentage).toBeLessThan(0.35);
      }
    });
  });

  describe("favouriteSelectionProbability = 1 (always prioritize favourites)", () => {
    test("only returns favourites when they exist", () => {
      const results = getShuffledReminders(20, mixedReminders, 1);
      for (const result of results) {
        expect(["fav1", "fav2"]).toContain(result);
      }
    });

    test("returns non-favourites when no favourites exist", () => {
      const results = getShuffledReminders(10, noFavourites, 1);
      expect(results).toHaveLength(10);
      for (const result of results) {
        expect(["normal1", "normal2", "normal3"]).toContain(result);
      }
    });
  });

  describe("favouriteSelectionProbability = 0.3 (default)", () => {
    test("returns mix with favourites appearing more often than random", () => {
      const results = getShuffledReminders(1000, mixedReminders, 0.3);
      let favouriteCount = 0;

      for (const result of results) {
        if (result.startsWith("fav")) {
          favouriteCount++;
        }
      }

      // With 30% probability and 2 favourites out of 5 total,
      // favourites should appear roughly 30% of the time
      const favPercentage = favouriteCount / results.length;
      expect(favPercentage).toBeGreaterThan(0.15);
      expect(favPercentage).toBeLessThan(0.45);
    });
  });

  describe("edge cases", () => {
    test("handles requesting zero reminders", () => {
      const result = getShuffledReminders(0, mixedReminders);
      expect(result).toHaveLength(0);
    });

    test("handles single reminder", () => {
      const single = [createReminder("only", true, true)];
      const result = getShuffledReminders(3, single);
      expect(result).toHaveLength(3);
      expect(result.every((r) => r === "only")).toBe(true);
    });

    test("handles all favourites", () => {
      const results = getShuffledReminders(10, allFavourites, 0.5);
      expect(results).toHaveLength(10);
      for (const result of results) {
        expect(["fav1", "fav2", "fav3"]).toContain(result);
      }
    });

    test("handles no favourites", () => {
      const results = getShuffledReminders(10, noFavourites, 0.5);
      expect(results).toHaveLength(10);
      for (const result of results) {
        expect(["normal1", "normal2", "normal3"]).toContain(result);
      }
    });
  });
});
