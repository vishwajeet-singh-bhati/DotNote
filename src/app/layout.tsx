import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "LectureFlow — AI-Powered Lecture Notes",
  description:
    "Turn YouTube lectures into detailed study notes, mind maps, glossaries, and revision sheets powered by AI.",
  keywords: [
    "lecture notes",
    "YouTube",
    "AI",
    "study",
    "mind map",
    "revision",
    "education",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
