import { normalizeInterestWord } from "./interest-entry.js";
// Keep known topic ids stable; custom interests are safe, bounded plain text.
export const SIGNUP_INTERESTS_MIN = 3;
export const SIGNUP_INTERESTS_MAX = 24;

export function normalizeSignupInterests(selected, allowed) {
  const unique = new Map();
  for (const item of selected || []) {
    const value = normalizeInterestWord(item, allowed);
    if (value && !unique.has(value.toLowerCase())) unique.set(value.toLowerCase(), value);
  }
  return [...unique.values()].slice(0, SIGNUP_INTERESTS_MAX);
}

export function signupInterestsError(selected, allowed) {
  const count = normalizeSignupInterests(selected, allowed).length;
  if (count < SIGNUP_INTERESTS_MIN) return `Choose at least ${SIGNUP_INTERESTS_MIN} interests (${count} selected).`;
  return "";
}

export function signupInterestsCountLabel(count) {
  return count >= SIGNUP_INTERESTS_MIN ? `${count} selected` : `${count} of ${SIGNUP_INTERESTS_MIN} minimum selected`;
}
