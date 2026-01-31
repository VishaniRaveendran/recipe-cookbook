import AsyncStorage from "@react-native-async-storage/async-storage";
import { FREE_SMART_IMPORTER_USES } from "@/constants/limits";

const KEY_COUNT = "smart_importer_use_count";

export async function getSmartImporterUseCount(): Promise<number> {
  const count = await AsyncStorage.getItem(KEY_COUNT);
  return parseInt(count ?? "0", 10);
}

export async function incrementSmartImporterUsage(): Promise<void> {
  const count = await getSmartImporterUseCount();
  await AsyncStorage.setItem(KEY_COUNT, String(count + 1));
}

export async function canUseSmartImporter(
  isPro: boolean,
  hasRecipePack: boolean
): Promise<boolean> {
  if (isPro || hasRecipePack) return true;
  const used = await getSmartImporterUseCount();
  return used < FREE_SMART_IMPORTER_USES;
}
