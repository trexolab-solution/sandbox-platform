import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { MaintenanceGuard } from "@/components/maintenance-guard";
import { Toaster } from "@/components/ui/sonner";
import { getSetting } from "@/lib/settings";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Sandbox Platform",
  description: "Cloud development environments",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Get default theme from admin settings
  const defaultTheme = await getSetting("defaultTheme");

  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme={defaultTheme}
          enableSystem
          disableTransitionOnChange
        >
          <MaintenanceGuard>
            {children}
          </MaintenanceGuard>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
