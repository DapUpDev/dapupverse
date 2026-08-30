import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import { Geist, Geist_Mono, Syne } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { SiteFooter } from "@/components/shell/site-footer";
import { SiteHeader } from "@/components/shell/site-header";
import { MockIdentityBridge } from "@/components/app/mock-identity-bridge";
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
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${syne.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-background font-sans">
        <ClerkProvider>
          <MockIdentityBridge>
            <SiteHeader />
            <div className="flex flex-1 flex-col">{children}</div>
            <SiteFooter />
            <Toaster />
          </MockIdentityBridge>
        </ClerkProvider>
      </body>
    </html>
  );
}
