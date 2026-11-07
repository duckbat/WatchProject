import type { Metadata } from "next";
import "./globals.css";
import "./app.css";
export const metadata: Metadata = { title: "WatchLedger", description: "Find your watch and track market prices." };
export default function RootLayout({children}: Readonly<{children: React.ReactNode}>) { return <html lang="en"><body>{children}</body></html>; }
