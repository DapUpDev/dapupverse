import type { Metadata } from "next";
import { Geist, Geist_Mono, Syne } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { SiteFooter } from "@/components/shell/site-footer";
import { SiteHeader } from "@/components/shell/site-header";
import { DemoSessionProvider } from "@/lib/demo-session/provider";
import { isPreviewEnvironment } from "@/lib/demo-session/preview";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Editorial display face for homepage statements and section openings.
const syne = Syne({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

export const metadata: Metadata = {
  title: {
    default: "DapUp",
    template: "%s | DapUp",
  },
  description:
    "DapUp is a mentor-discovery and connection platform where students find mentors, send connection requests, and message their connections.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  // Decided on the server; client UI only ever receives the boolean.
  const previewEnabled = isPreviewEnvironment();

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${syne.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-background font-sans">
        <DemoSessionProvider previewEnabled={previewEnabled}>
          <SiteHeader />
          <div className="flex flex-1 flex-col">{children}</div>
          <SiteFooter />
          <Toaster />
        </DemoSessionProvider>
      </body>
    </html>
  );
}
