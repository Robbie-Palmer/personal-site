import { Badge } from "@/components/ui/badge";
import type { AccountSummaryView } from "@/lib/api/assettracker";
import type { AssetType, Currency } from "@/lib/domain/assettracker";
import { computeTotalBalance } from "@/lib/domain/assettracker";

const ASSET_TYPE_VARIANT: Record<
  AssetType,
  "default" | "secondary" | "outline"
> = {
  cash: "default",
  stocks: "secondary",
  crypto: "outline",
};

function formatAccountCurrency(amount: number, currency: Currency): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
  }).format(amount);
}

interface AccountsTableProps {
  accounts: AccountSummaryView[];
}

export function AccountsTable({ accounts }: AccountsTableProps) {
  const totalBalance = computeTotalBalance(accounts);
  // Use first account's currency for total (assumes homogeneous currency)
  const totalCurrency = accounts[0]?.currency ?? "GBP";
  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left p-3 font-medium">Account</th>
              <th className="text-left p-3 font-medium">Provider</th>
              <th className="text-left p-3 font-medium">Type</th>
              <th className="text-right p-3 font-medium">Balance</th>
              <th className="text-right p-3 font-medium">Expected Return</th>
              <th className="text-left p-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((account) => (
              <tr key={account.id} className="border-b last:border-b-0">
                <td className="p-3 font-medium">{account.name}</td>
                <td className="p-3 text-muted-foreground">
                  {account.provider}
                </td>
                <td className="p-3">
                  <Badge variant={ASSET_TYPE_VARIANT[account.assetType]}>
                    {account.assetType}
                  </Badge>
                </td>
                <td className="p-3 text-right font-mono">
                  {account.latestBalance != null
                    ? formatAccountCurrency(
                        account.latestBalance,
                        account.currency,
                      )
                    : "-"}
                </td>
                <td className="p-3 text-right font-mono">
                  {(account.expectedAnnualReturn * 100).toFixed(1)}%
                </td>
                <td className="p-3">
                  <Badge variant={account.isOpen ? "default" : "secondary"}>
                    {account.isOpen ? "Open" : "Closed"}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-muted/50">
              <td colSpan={3} className="p-3 font-semibold">
                Total
              </td>
              <td className="p-3 text-right font-mono font-semibold">
                {formatAccountCurrency(totalBalance, totalCurrency)}
              </td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
