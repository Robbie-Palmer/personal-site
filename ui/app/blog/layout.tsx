export default function BlogLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {/* Preconnect to Cloudflare Images for faster image loading */}
      <link
        rel="preconnect"
        href="https://imagedelivery.net"
        crossOrigin="anonymous"
      />
      {children}
    </>
  );
}
