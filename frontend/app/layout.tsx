import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SMARTBUS // Municipal Transit Safety Console",
  description: "Real-time ESP32 IoT door safety and passenger monitoring operations console",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="bg-base-950 antialiased">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-base-950 text-slate-100">{children}</body>
    </html>
  );
}
