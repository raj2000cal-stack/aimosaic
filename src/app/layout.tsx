import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AIMosaic: every leading AI model in one workspace",
  description:
    "One subscription, many AI models, side-by-side comparison and a transparent token wallet.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
