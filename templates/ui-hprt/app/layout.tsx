import type { Metadata } from "next";
import { Roboto, Roboto_Mono } from "next/font/google";
import "./globals.scss";
import { Providers } from "@/components/providers/UrqlProvider";
import { StyleProvider } from "@corpdk/ui-core";

const robotoSans = Roboto({
  variable: "--font-roboto-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
});

const robotoMono = Roboto_Mono({
  variable: "--font-roboto-mono",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "Next.js Template (HPRT)",
  description: "A generic Next.js starter template with urql, Graphcache, and real-time subscriptions",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${robotoSans.variable} ${robotoMono.variable} antialiased`}
      >
        <StyleProvider attribute="class" defaultTheme="system" enableSystem>
          <Providers>{children}</Providers>
        </StyleProvider>
      </body>
    </html>
  );
}
