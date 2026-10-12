import { ClerkProvider } from "@clerk/nextjs";
import { Analytics } from "@vercel/analytics/next";
import type { Metadata } from "next";
import { EB_Garamond, Geist } from "next/font/google";
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

// Headlines and names: an editorial serif at regular weight, the way
// Hermès sets its headlines.
const bricolage = EB_Garamond({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.dapup.space"),
  title: {
    default: "DapUp: learn from students who've already made it",
    template: "%s | DapUp",
  },
  description:
    "DapUp connects NZ students with approved student mentors who sat the same exams and got into universities like Stanford, LSE, NUS and Harvard. Send one request, get essay review, application advice or subject help.",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "DapUp",
    url: "/",
    title: "DapUp: learn from students who've already made it",
    description:
      "Approved student mentors who sat the same exams and got into the places you're aiming for. For students. By students.",
  },
  robots: { index: true, follow: true },
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
        <Analytics />
      </body>
    </html>
  );
}
