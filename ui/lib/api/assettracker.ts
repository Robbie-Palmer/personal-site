import {
  type AssetTrackerData,
  AssetTrackerDataSchema,
  applyCloseAccount,
  applyCreateAccount,
  applyDeleteSnapshot,
  applyRecordBalance,
  buildRepository,
  type CloseAccountInput,
  type CreateAccountInput,
  type DeleteSnapshotInput,
  getSeedData,
  type RecordBalanceInput,
} from "@/lib/domain/assettracker";

/**
 * The Asset Tracker API boundary. Every method is async and mirrors the
 * endpoint a Cloudflare Worker + D1 backend would expose (POST /accounts,
 * PUT /balances, ...), so swapping the local implementation for an HTTP
 * client is a drop-in change. While the site is statically generated, the
 * "backend" is the same domain commands run against browser storage.
 */
export interface AssetTrackerApi {
  load(): Promise<AssetTrackerLoadResult>;
  createAccount(input: CreateAccountInput): Promise<AssetTrackerData>;
  recordBalance(input: RecordBalanceInput): Promise<AssetTrackerData>;
  closeAccount(input: CloseAccountInput): Promise<AssetTrackerData>;
  deleteSnapshot(input: DeleteSnapshotInput): Promise<AssetTrackerData>;
  importData(raw: unknown): Promise<AssetTrackerData>;
  reset(): Promise<AssetTrackerData>;
}

export type AssetTrackerLoadResult = {
  data: AssetTrackerData;
  /** True when the data carries the user's own changes rather than the pristine demo seed */
  persisted: boolean;
};

export const ASSET_TRACKER_STORAGE_KEY = "assettracker:data:v1";

function parseStored(raw: string): AssetTrackerData {
  const data = AssetTrackerDataSchema.parse(JSON.parse(raw));
  buildRepository(data); // referential integrity (duplicate IDs, orphan snapshots)
  return data;
}

export function createLocalAssetTrackerApi(storage: Storage): AssetTrackerApi {
  function readStored(): AssetTrackerData | null {
    const raw = storage.getItem(ASSET_TRACKER_STORAGE_KEY);
    if (raw == null) return null;
    try {
      return parseStored(raw);
    } catch {
      // Unreadable local data: fall back to the seed but leave the stored
      // value untouched until the next successful write
      return null;
    }
  }

  function write(data: AssetTrackerData): AssetTrackerData {
    storage.setItem(ASSET_TRACKER_STORAGE_KEY, JSON.stringify(data));
    return data;
  }

  function current(): AssetTrackerData {
    return readStored() ?? getSeedData();
  }

  return {
    async load() {
      const stored = readStored();
      return { data: stored ?? getSeedData(), persisted: stored !== null };
    },
    async createAccount(input) {
      return write(applyCreateAccount(current(), input).data);
    },
    async recordBalance(input) {
      return write(applyRecordBalance(current(), input));
    },
    async closeAccount(input) {
      return write(applyCloseAccount(current(), input));
    },
    async deleteSnapshot(input) {
      return write(applyDeleteSnapshot(current(), input));
    },
    async importData(raw) {
      const data = AssetTrackerDataSchema.parse(raw);
      buildRepository(data);
      return write(data);
    },
    async reset() {
      storage.removeItem(ASSET_TRACKER_STORAGE_KEY);
      return getSeedData();
    },
  };
}
