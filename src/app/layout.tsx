import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AIMosaic: every leading AI model in one workspace",
  description:
    "One subscription, many AI models, side-by-side comparison and a transparent token wallet.",
};

/** Applies the saved theme before first paint, so there is no flash. */
const themeScript = `try{if(localStorage.getItem("aimosaic-theme")==="dark")document.documentElement.dataset.theme="dark"}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
