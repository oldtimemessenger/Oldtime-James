import { api } from "./store.js";
import { normalizeInterestWord } from "./interest-entry.js";

export const INTERESTS = ["Sports", "Photography", "Music", "Comedy", "Food", "Travel", "Fitness", "News", "Art", "Gaming", "Fashion", "Technology", "Running", "Basketball", "Yoga", "College life", "Nursing", "Cybersecurity", "Study groups", "Cars", "Pets", "Beauty"];
const interestAliases={tech:"Technology",college:"College life","study-groups":"Study groups"};
function normalizeInterest(item){
  if(typeof item!=="string")return null;
  const value=item.trim().toLowerCase();
  return interestAliases[value]||normalizeInterestWord(item, INTERESTS)||null;
}

function ownsAccount(accountId) {
  return [api.cloudAccountId(), api.me()?.id].filter(Boolean).includes(accountId);
}

export function readInterests(accountId) {
  if (!ownsAccount(accountId) || !api.cloudAccountStateLoaded()) return null;
  const preferences = api.cloudAccountState()?.interestPreferences;
  if (!preferences) return { enabled: true, selected: [], decided: false };
  return {
    enabled: preferences.enabled !== false,
    selected: [...new Set((Array.isArray(preferences.selected) ? preferences.selected : []).map(normalizeInterest).filter(Boolean))],
    decided: true,
  };
}

export async function saveInterests(accountId, { enabled = true, selected = [] }) {
  if (!ownsAccount(accountId)) throw new Error("Sign in to save your interests to your account.");
  const clean = [...new Set((Array.isArray(selected) ? selected : []).map(normalizeInterest).filter(Boolean))];
  await api.updateCloudAccountState({
    interestPreferences: { enabled: !!enabled, selected: clean },
  });
  return clean;
}

export async function resetInterests(accountId) {
  if (!ownsAccount(accountId)) throw new Error("Sign in to reset your interests.");
  await api.updateCloudAccountState({ interestPreferences: null });
}

export function interestContext(accountId) {
  const value = readInterests(accountId);
  return value ? { interests: value.enabled ? value.selected : [], interestsSet: value.decided } :
    { interests: [], interestsSet: true };
}
