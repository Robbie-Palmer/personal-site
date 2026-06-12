"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  type AssetTrackerApi,
  createLocalAssetTrackerApi,
} from "@/lib/api/assettracker";
import {
  type AccountDetailView,
  type AccountId,
  type AccountSummaryView,
  type AssetTrackerData,
  type AssetType,
  buildRepository,
  type CreateAccountInput,
  type DeleteSnapshotInput,
  getAllAccountDetails,
  getAllAccountSummaries,
  getNetWorthTimeSeries,
  getSeedData,
  getTotalByAssetType,
  type NetWorthDataPoint,
  type RecordBalanceInput,
  todayIsoDate,
} from "@/lib/domain/assettracker";

interface AssetTrackerContextValue {
  accounts: AccountSummaryView[];
  accountDetails: AccountDetailView[];
  netWorthData: NetWorthDataPoint[];
  assetAllocation: { assetType: AssetType; total: number }[];
  /** True once the user has made changes that are persisted in this browser */
  hasLocalChanges: boolean;
  createAccount(input: CreateAccountInput): Promise<void>;
  recordBalance(input: RecordBalanceInput): Promise<void>;
  closeAccount(accountId: AccountId): Promise<void>;
  deleteSnapshot(input: DeleteSnapshotInput): Promise<void>;
  resetData(): Promise<void>;
  exportData(): void;
  importData(file: File): Promise<void>;
}

const AssetTrackerContext = createContext<AssetTrackerContextValue | null>(
  null,
);

export function AssetTrackerProvider({ children }: { children: ReactNode }) {
  // Seed synchronously so the static build renders the full demo dashboard;
  // locally saved changes are applied after mount to avoid hydration mismatch
  const [data, setData] = useState<AssetTrackerData>(getSeedData);
  const [hasLocalChanges, setHasLocalChanges] = useState(false);
  const apiRef = useRef<AssetTrackerApi | null>(null);

  const getApi = useCallback(() => {
    apiRef.current ??= createLocalAssetTrackerApi(window.localStorage);
    return apiRef.current;
  }, []);

  useEffect(() => {
    let cancelled = false;
    getApi()
      .load()
      .then(({ data: stored, persisted }) => {
        if (cancelled || !persisted) return;
        setData(stored);
        setHasLocalChanges(true);
      });
    return () => {
      cancelled = true;
    };
  }, [getApi]);

  const mutate = useCallback(
    async (run: (api: AssetTrackerApi) => Promise<AssetTrackerData>) => {
      const next = await run(getApi());
      setData(next);
      setHasLocalChanges(true);
    },
    [getApi],
  );

  const views = useMemo(() => {
    const repository = buildRepository(data);
    return {
      accounts: getAllAccountSummaries(repository),
      accountDetails: getAllAccountDetails(repository),
      netWorthData: getNetWorthTimeSeries(repository),
      assetAllocation: getTotalByAssetType(repository),
    };
  }, [data]);

  const value = useMemo<AssetTrackerContextValue>(
    () => ({
      ...views,
      hasLocalChanges,
      createAccount: (input) => mutate((api) => api.createAccount(input)),
      recordBalance: (input) => mutate((api) => api.recordBalance(input)),
      closeAccount: (accountId) =>
        mutate((api) =>
          api.closeAccount({ accountId, closedAt: todayIsoDate() }),
        ),
      deleteSnapshot: (input) => mutate((api) => api.deleteSnapshot(input)),
      resetData: async () => {
        const seed = await getApi().reset();
        setData(seed);
        setHasLocalChanges(false);
      },
      exportData: () => {
        const blob = new Blob([JSON.stringify(data, null, 2)], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = `assettracker-${todayIsoDate()}.json`;
        anchor.click();
        URL.revokeObjectURL(url);
      },
      importData: async (file) => {
        const raw = JSON.parse(await file.text());
        await mutate((api) => api.importData(raw));
      },
    }),
    [views, hasLocalChanges, data, mutate, getApi],
  );

  return (
    <AssetTrackerContext.Provider value={value}>
      {children}
    </AssetTrackerContext.Provider>
  );
}

export function useAssetTracker(): AssetTrackerContextValue {
  const context = useContext(AssetTrackerContext);
  if (!context) {
    throw new Error(
      "useAssetTracker must be used within an AssetTrackerProvider",
    );
  }
  return context;
}
