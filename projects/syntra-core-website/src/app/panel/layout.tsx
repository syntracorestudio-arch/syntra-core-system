import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Panel interno",
  // El panel nunca debe indexarse.
  robots: { index: false, follow: false },
};

export default function PanelLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <div className="min-h-screen bg-background">{children}</div>;
}
