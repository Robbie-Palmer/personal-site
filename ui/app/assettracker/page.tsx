export default function AssetTrackerPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold mb-4">Welcome to Asset Tracker</h1>
        <p className="text-lg text-muted-foreground">
          Track and manage all your assets in one place.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <div className="border rounded-lg p-6 space-y-2">
          <h2 className="text-xl font-semibold">Dashboard</h2>
          <p className="text-muted-foreground">
            View an overview of all your tracked assets.
          </p>
        </div>

        <div className="border rounded-lg p-6 space-y-2">
          <h2 className="text-xl font-semibold">Add Asset</h2>
          <p className="text-muted-foreground">
            Register new assets to your tracking system.
          </p>
        </div>

        <div className="border rounded-lg p-6 space-y-2">
          <h2 className="text-xl font-semibold">Reports</h2>
          <p className="text-muted-foreground">
            Generate detailed reports on your assets.
          </p>
        </div>
      </div>

      <div className="border rounded-lg p-8 space-y-4">
        <h2 className="text-2xl font-semibold">Getting Started</h2>
        <div className="space-y-2">
          <p>This is a placeholder for the Asset Tracker application.</p>
          <ul className="list-disc list-inside space-y-1 text-muted-foreground">
            <li>Create and manage asset records</li>
            <li>Track asset status and location</li>
            <li>Generate comprehensive reports</li>
            <li>Monitor asset lifecycle</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
