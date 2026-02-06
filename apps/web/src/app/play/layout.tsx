export default function PlayLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <style>{`.shell { padding: 0 !important; }`}</style>
      {children}
    </>
  );
}
