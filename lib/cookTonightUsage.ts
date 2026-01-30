import AsyncStorage from "@react-native-async-storage/async-storage";
import { FREE_COOK_TONIGHT_PER_WEEK } from "@/constants/limits";

const KEY_WEEK = "cook_tonight_week";
const KEY_COUNT = "cook_tonight_count";

function getCurrentWeek(): string {
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - now.getDay());
  start.setHours(0, 0, 0, 0);
  return start.toISOString().slice(0, 10);
}

export async function getCookTonightUsedThisWeek(): Promise<number> {
  const week = getCurrentWeek();
  const storedWeek = await AsyncStorage.getItem(KEY_WEEK);
  if (storedWeek !== week) return 0;
  const count = await AsyncStorage.getItem(KEY_COUNT);
  return parseInt(count ?? "0", 10);
}

export async function incrementCookTonightUsage(): Promise<void> {
  const week = getCurrentWeek();
  const storedWeek = await AsyncStorage.getItem(KEY_WEEK);
  let count = 0;
  if (storedWeek === week) {
    const c = await AsyncStorage.getItem(KEY_COUNT);
    count = parseInt(c ?? "0", 10);
  }
  await AsyncStorage.setItem(KEY_WEEK, week);
  await AsyncStorage.setItem(KEY_COUNT, String(count + 1));
}

export async function canUseCookTonight(isPremium: boolean): Promise<boolean> {
  if (isPremium) return true;
  const used = await getCookTonightUsedThisWeek();
  return used < FREE_COOK_TONIGHT_PER_WEEK;
}
