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
  type AddRecurringFlowInput,
  type AssetTrackerData,
  type AssetType,
  buildRepository,
  type CreateAccountInput,
  type DeleteSnapshotInput,
  getAllAccountDetails,
  getAllAccountSummaries,
  getNetWorthTimeSeries,
  getPortfolioAnnualReturn,
  getSeedData,
  getTotalByAssetType,
  type NetWorthDataPoint,
  type RecordBalanceInput,
  type RecordTransferInput,
  type RecurringFlow,
  type SetExpectedReturnInput,
  type Transfer,
  toBalancesCsv,
  todayIsoDate,
} from "@/lib/domain/assettracker";

interface AssetTrackerContextValue {
  accounts: AccountSummaryView[];
  accountDetails: AccountDetailView[];
  netWorthData: NetWorthDataPoint[];
  assetAllocation: { assetType: AssetType; total: number }[];
  transfers: Transfer[];
  recurringFlows: RecurringFlow[];
  /** Annualised portfolio growth, excluding recorded external money in/out */
  portfolioReturn: number | null;
  /** Expected annual inflation used to express values in today's money */
  inflation: number;
  /** The net worth the user is aiming for, if set */
  netWorthTarget: number | null;
  /** Whether the target is expressed in today's money (inflation-adjusted) */
  netWorthTargetIsReal: boolean;
  /** True once the user has made changes that are persisted in this browser */
  hasLocalChanges: boolean;
  createAccount(input: CreateAccountInput): Promise<void>;
  recordBalance(input: RecordBalanceInput): Promise<void>;
  recordTransfer(input: RecordTransferInput): Promise<void>;
  closeAccount(
    accountId: AccountId,
    transferToAccountId?: AccountId,
  ): Promise<void>;
  deleteSnapshot(input: DeleteSnapshotInput): Promise<void>;
  addRecurringFlow(input: AddRecurringFlowInput): Promise<void>;
  deleteRecurringFlow(id: string): Promise<void>;
  materializeFlow(flowId: string): Promise<void>;
  setExpectedReturn(input: SetExpectedReturnInput): Promise<void>;
  setInflation(rate: number): Promise<void>;
  setNetWorthTarget(
    target: number | null,
    inTodaysMoney?: boolean,
  ): Promise<void>;
  resetData(): Promise<void>;
  exportData(): void;
  exportCsv(): void;
  importData(file: File): Promise<void>;
}

const AssetTrackerContext = createContext<AssetTrackerContextValue | null>(
  null,
);

function downloadFile(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function AssetTrackerProvider({ children }: { children: ReactNode }) {
  // Seed synchronously so the static build renders the full demo dashboard;
  // locally saved changes are applied after mount to avoid hydration mismatch
  const [data, setData] = useState<AssetTrackerData>(getSeedData);
  const [hasLocalChanges, setHasLocalChanges] = useState(false);
  const apiRef = useRef<AssetTrackerApi | null>(null);
  // Once the user has mutated, a late-resolving load() must not clobber the
  // fresher state with the older persisted snapshot
  const hasMutatedRef = useRef(false);

  const getApi = useCallback(() => {
    apiRef.current ??= createLocalAssetTrackerApi(window.localStorage);
    return apiRef.current;
  }, []);

  useEffect(() => {
    let cancelled = false;
    getApi()
      .load()
      .then(({ data: stored, persisted }) => {
        if (cancelled || hasMutatedRef.current || !persisted) return;
        setData(stored);
        setHasLocalChanges(true);
      })
      .catch((err) => {
        console.warn("AssetTracker: failed to load stored data", err);
      });
    return () => {
      cancelled = true;
    };
  }, [getApi]);

  const mutate = useCallback(
    async (run: (api: AssetTrackerApi) => Promise<AssetTrackerData>) => {
      hasMutatedRef.current = true;
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
      transfers: repository.transfers,
      recurringFlows: repository.recurringFlows,
      portfolioReturn: getPortfolioAnnualReturn(repository),
      inflation: repository.settings.expectedAnnualInflation,
      netWorthTarget: repository.settings.targetNetWorth ?? null,
      netWorthTargetIsReal: repository.settings.targetNetWorthIsReal ?? false,
    };
  }, [data]);

  const value = useMemo<AssetTrackerContextValue>(
    () => ({
      ...views,
      hasLocalChanges,
      createAccount: (input) => mutate((api) => api.createAccount(input)),
      recordBalance: (input) => mutate((api) => api.recordBalance(input)),
      recordTransfer: (input) => mutate((api) => api.recordTransfer(input)),
      closeAccount: (accountId, transferToAccountId) =>
        mutate((api) =>
          api.closeAccount({
            accountId,
            closedAt: todayIsoDate(),
            transferToAccountId,
          }),
        ),
      deleteSnapshot: (input) => mutate((api) => api.deleteSnapshot(input)),
      addRecurringFlow: (input) => mutate((api) => api.addRecurringFlow(input)),
      deleteRecurringFlow: (id) =>
        mutate((api) => api.deleteRecurringFlow({ id })),
      materializeFlow: (flowId) =>
        mutate((api) =>
          api.materializeFlow({ flowId, throughDate: todayIsoDate() }),
        ),
      setExpectedReturn: (input) =>
        mutate((api) => api.setExpectedReturn(input)),
      setInflation: (rate) => mutate((api) => api.setInflation({ rate })),
      setNetWorthTarget: (target, inTodaysMoney) =>
        mutate((api) => api.setNetWorthTarget({ target, inTodaysMoney })),
      resetData: async () => {
        const seed = await getApi().reset();
        setData(seed);
        setHasLocalChanges(false);
      },
      exportData: () =>
        downloadFile(
          `assettracker-${todayIsoDate()}.json`,
          JSON.stringify(data, null, 2),
          "application/json",
        ),
      exportCsv: () =>
        downloadFile(
          `assettracker-balances-${todayIsoDate()}.csv`,
          toBalancesCsv(data),
          "text/csv",
        ),
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
