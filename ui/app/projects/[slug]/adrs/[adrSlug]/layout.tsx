import { ScrollProgress } from "@/components/ui/scroll-progress";

export default function ADRPageLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <ScrollProgress />
      {children}
    </>
  );
}
