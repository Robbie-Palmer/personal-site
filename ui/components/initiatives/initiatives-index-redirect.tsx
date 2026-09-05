import Link from "next/link";

const initiativesTab = "/projects?tab=initiatives";

export function InitiativesIndexRedirect() {
  return (
    <>
      <meta httpEquiv="refresh" content={`0;url=${initiativesTab}`} />
      <div className="container mx-auto max-w-6xl px-4 py-12">
        <p className="text-muted-foreground">
          Opening the{" "}
          <Link className="underline underline-offset-4" href={initiativesTab}>
            initiatives tab
          </Link>
          ...
        </p>
      </div>
    </>
  );
}
