import { ScrollProgress } from "@/components/ui/scroll-progress";

export default function BlogPostLayout({
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
