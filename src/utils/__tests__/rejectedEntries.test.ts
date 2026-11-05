import {
  altimeterEntryKey,
  rejectedEntryNotifications,
  rejectedEntryText,
  updateRejectedEntries,
  windEntryKey,
  type RejectedEntry,
} from "../rejectedEntries";
import { fieldSubject } from "../notifications";
import type { WorksheetData } from "../types";

const state = (overrides: Partial<WorksheetData> = {}): WorksheetData =>
  ({
    wind: [
      [null, null, null, null, null],
      [null, null, null, null, null],
      [null, null, null, null, null],
    ],
    altimeter: [null, null, null],
    ...overrides,
  }) as WorksheetData;

const windEntry: RejectedEntry = {
  raw: "400",
  storedValue: null,
  notification: {
    level: "warning",
    subject: fieldSubject("wind", 2),
    message: "Wind direction 400 at 9,000 ft is not valid",
  },
};

const altimeterEntry: RejectedEntry = {
  raw: "35.00",
  storedValue: 29.92,
  notification: {
    level: "warning",
    subject: fieldSubject("altimeter", 0),
    message: "Altimeter 35.00 is not valid",
  },
};

describe("rejected weather entries", () => {
  it("raises each rejected entry's Warning while its field is unchanged", () => {
    const s = state({ altimeter: [29.92, null, null] });
    const entries = updateRejectedEntries(
      s,
      updateRejectedEntries(s, {}, windEntryKey(0, 2), windEntry),
      altimeterEntryKey(0),
      altimeterEntry
    );
    expect(rejectedEntryNotifications(s, entries)).toEqual([
      windEntry.notification,
      altimeterEntry.notification,
    ]);
    expect(rejectedEntryText(s, entries, windEntryKey(0, 2))).toBe("400");
  });

  it("drops the Warning and raw text once the field holds a different value", () => {
    const entries = updateRejectedEntries(state(), {}, windEntryKey(0, 2), windEntry);
    const filled = state({
      wind: [
        [null, null, 270, null, null],
        [null, null, null, null, null],
        [null, null, null, null, null],
      ],
    });
    expect(rejectedEntryNotifications(filled, entries)).toEqual([]);
    expect(rejectedEntryText(filled, entries, windEntryKey(0, 2))).toBeUndefined();
  });

  it("clears an entry when the pilot enters a valid value", () => {
    const s = state();
    const entries = updateRejectedEntries(s, {}, windEntryKey(0, 2), windEntry);
    expect(
      rejectedEntryNotifications(s, updateRejectedEntries(s, entries, windEntryKey(0, 2), null))
    ).toEqual([]);
  });

  it("forgets entries no longer in force, so they can't return when the value does", () => {
    const entries = updateRejectedEntries(state(), {}, windEntryKey(0, 2), windEntry);
    const filled = state({
      wind: [
        [null, null, 270, null, null],
        [null, null, null, null, null],
        [null, null, null, null, null],
      ],
    });
    const later = updateRejectedEntries(filled, entries, altimeterEntryKey(1), null);
    expect(rejectedEntryNotifications(state(), later)).toEqual([]);
  });
});
