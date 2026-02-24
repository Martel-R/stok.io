
import { toDate } from "./utils";
import { Timestamp } from "firebase/firestore";

describe('toDate utility', () => {
  it('should return undefined for null or undefined', () => {
    expect(toDate(null)).toBeUndefined();
    expect(toDate(undefined)).toBeUndefined();
  });

  it('should return the same date if a Date instance is passed', () => {
    const date = new Date();
    expect(toDate(date)).toBe(date);
  });

  it('should convert a Firestore Timestamp to a Date instance', () => {
    const seconds = 1708696800; // 2024-02-23
    const ts = new Timestamp(seconds, 0);
    const result = toDate(ts);
    expect(result).toBeInstanceOf(Date);
    expect(result?.getTime()).toBe(seconds * 1000);
  });

  it('should handle serialized timestamps (plain objects)', () => {
    const seconds = 1708696800;
    const plainObj = { seconds, nanoseconds: 0 };
    const result = toDate(plainObj);
    expect(result).toBeInstanceOf(Date);
    expect(result?.getTime()).toBe(seconds * 1000);
  });

  it('should return undefined for invalid types', () => {
    expect(toDate('invalid-date')).toBeUndefined();
    expect(toDate(123456789)).toBeUndefined();
  });
});
