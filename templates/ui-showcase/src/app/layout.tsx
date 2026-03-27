import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider, SonnerToaster } from "@corpdk/ui-core";
import { AppErrorBoundary } from "@corpdk/ui-feedback";
import { SessionProvider } from "@corpdk/ui-auth";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "UI Showcase",
  description: "Living reference for @corpdk/ui-* shared packages",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <SessionProvider>
            <AppErrorBoundary>
              {children}
            </AppErrorBoundary>
          </SessionProvider>
          <SonnerToaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
