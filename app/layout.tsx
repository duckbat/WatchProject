import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "WatchLedger — Your watches, in perspective", description: "Track your collection and compare regional watch market prices." };
export default function RootLayout({children}: Readonly<{children: React.ReactNode}>) { return <html lang="en"><body>{children}</body></html>; }
