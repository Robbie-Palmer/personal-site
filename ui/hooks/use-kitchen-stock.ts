"use client";

import { useSyncExternalStore } from "react";
import {
  getKitchenStockSnapshot,
  getServerKitchenStockSnapshot,
  type KitchenStock,
  subscribeKitchenStock,
} from "@/lib/kitchen/kitchenStockStore";

export function useKitchenStock(): KitchenStock {
  return useSyncExternalStore(
    subscribeKitchenStock,
    getKitchenStockSnapshot,
    getServerKitchenStockSnapshot,
  );
}
