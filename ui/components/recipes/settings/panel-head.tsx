export function PanelHead({
  kicker,
  title,
  sub,
}: {
  kicker: string;
  title: string;
  sub?: string;
}) {
  return (
    <div className="mb-6">
      <p className="rt-mono text-[var(--terracotta)]">{kicker}</p>
      <h2 className="rt-display mt-0.5 text-4xl">{title}</h2>
      {sub && (
        <p className="rt-body mt-1.5 max-w-xl text-[0.95rem] text-[var(--ink-2)]">
          {sub}
        </p>
      )}
    </div>
  );
}
