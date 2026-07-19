import { ScrollProgress } from "@/components/ui/scroll-progress";

export default function ADRPageLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <ScrollProgress />
      {children}
    </>
  );
}
