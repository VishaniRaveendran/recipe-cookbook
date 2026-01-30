import React, { createContext, useContext, useEffect, useState } from "react";
import { Platform } from "react-native";
import { REVENUECAT_ENTITLEMENT_PREMIUM } from "@/constants/limits";

const REVENUECAT_API_KEY_IOS =
  process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_IOS ?? "";
const REVENUECAT_API_KEY_ANDROID =
  process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID ?? "";

type CustomerInfo = {
  entitlements: { active: Record<string, unknown> };
};

type SubscriptionContextType = {
  isPremium: boolean;
  customerInfo: CustomerInfo | null;
  isLoading: boolean;
  refreshCustomerInfo: () => Promise<void>;
  restorePurchases: () => Promise<boolean>;
};

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(
  undefined
);

const isNative = Platform.OS === "ios" || Platform.OS === "android";

export function SubscriptionProvider({
  children,
  userId,
}: {
  children: React.ReactNode;
  userId: string | undefined;
}) {
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isNative) {
      setIsLoading(false);
      return;
    }
    const apiKey =
      Platform.OS === "ios"
        ? REVENUECAT_API_KEY_IOS
        : REVENUECAT_API_KEY_ANDROID;
    if (!apiKey) {
      setIsLoading(false);
      return;
    }
    import("react-native-purchases")
      .then(({ default: Purchases }) => {
        Purchases.configure({ apiKey });
        Purchases.getCustomerInfo()
          .then(setCustomerInfo)
          .catch(() => setCustomerInfo(null))
          .finally(() => setIsLoading(false));
      })
      .catch(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    if (!isNative || !userId) return;
    import("react-native-purchases").then(({ default: Purchases }) => {
      Purchases.logIn(userId)
        .then(({ customerInfo: info }) => setCustomerInfo(info))
        .catch(() => {});
    });
  }, [userId]);

  const refreshCustomerInfo = async () => {
    if (!isNative) return;
    try {
      const { default: Purchases } = await import("react-native-purchases");
      const info = await Purchases.getCustomerInfo();
      setCustomerInfo(info);
    } catch {
      setCustomerInfo(null);
    }
  };

  const restorePurchases = async (): Promise<boolean> => {
    if (!isNative) return false;
    try {
      const { default: Purchases } = await import("react-native-purchases");
      const info = await Purchases.restorePurchases();
      setCustomerInfo(info);
      return (
        (info.entitlements.active[REVENUECAT_ENTITLEMENT_PREMIUM] ?? null) !=
        null
      );
    } catch {
      return false;
    }
  };

  const isPremium =
    (customerInfo?.entitlements?.active?.[REVENUECAT_ENTITLEMENT_PREMIUM] ??
      null) != null;

  return (
    <SubscriptionContext.Provider
      value={{
        isPremium,
        customerInfo,
        isLoading,
        refreshCustomerInfo,
        restorePurchases,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const ctx = useContext(SubscriptionContext);
  if (ctx === undefined)
    throw new Error("useSubscription must be used within SubscriptionProvider");
  return ctx;
}
