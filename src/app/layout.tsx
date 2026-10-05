import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import { Bricolage_Grotesque, Geist } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { SiteFooter } from "@/components/shell/site-footer";
import { SiteHeader } from "@/components/shell/site-header";
import { MockIdentityBridge } from "@/components/app/mock-identity-bridge";
import "./globals.css";

// Everything that is read or operated.
const geist = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

// Headlines only. The optical-size axis keeps large settings tight.
const bricolage = Bricolage_Grotesque({
  variable: "--font-display",
  subsets: ["latin"],
  axes: ["opsz"],
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
      className={`${geist.variable} ${bricolage.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
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
