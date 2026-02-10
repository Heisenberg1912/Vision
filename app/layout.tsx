import type { Metadata } from "next";
import "../src/index.css";

export const metadata: Metadata = {
  title: "VitruviAI | Construction Snapshot",
  description: "AI-powered construction resource planning and execution analysis",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
