export const OLD_TIME_SIGNUP_MINIMUM_AGE = 16;

export function signupAgeError(birthday: string, now: Date = new Date()): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(birthday ?? ""));
  if (!match) return "Enter a valid birthday.";

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const birthDate = new Date(Date.UTC(year, month - 1, day));
  if (
    birthDate.getUTCFullYear() !== year ||
    birthDate.getUTCMonth() !== month - 1 ||
    birthDate.getUTCDate() !== day
  ) return "Enter a valid birthday.";

  const currentYear = now.getUTCFullYear();
  const currentMonth = now.getUTCMonth() + 1;
  const currentDay = now.getUTCDate();
  if (year > currentYear || (year === currentYear && (month > currentMonth || (month === currentMonth && day > currentDay)))) {
    return "Enter a valid birthday.";
  }

  let age = currentYear - year;
  if (month > currentMonth || (month === currentMonth && day > currentDay)) age -= 1;
  return age >= OLD_TIME_SIGNUP_MINIMUM_AGE ? null : "Oldtime is for people 16 and older.";
}
