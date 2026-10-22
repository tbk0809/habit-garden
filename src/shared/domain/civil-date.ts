declare const civilDateBrand: unique symbol;
export type CivilDate = string & { readonly [civilDateBrand]: true };

export function civilDate(value: unknown): CivilDate {
  if (
    typeof value !== "string" ||
    value.length !== 10 ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    throw new TypeError("Expected a canonical Gregorian civil date.");
  }

  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  const daysInMonth = [
    31,
    isLeapYear(year) ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ][month - 1];

  if (year < 1 || daysInMonth === undefined || day < 1 || day > daysInMonth) {
    throw new TypeError("Expected a real Gregorian civil date.");
  }

  return value as CivilDate;
}

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function ordinal(date: CivilDate): number {
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  const day = Number(date.slice(8, 10));
  const priorYear = year - 1;
  const priorMonthDays = [
    0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334,
  ][month - 1]!;
  return (
    365 * priorYear +
    Math.floor(priorYear / 4) -
    Math.floor(priorYear / 100) +
    Math.floor(priorYear / 400) +
    priorMonthDays +
    (month > 2 && isLeapYear(year) ? 1 : 0) +
    day
  );
}

// Inputs are validated civil dates, so DST and process timezone never enter this arithmetic.
export function civilDaysBetween(previous: CivilDate, next: CivilDate): number {
  return ordinal(next) - ordinal(previous);
}
