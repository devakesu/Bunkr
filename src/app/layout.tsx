import type { Metadata } from "next";
import ReactQueryProvider from "@/providers/react-query";
import { Manrope, DM_Mono } from "next/font/google";
import localFont from "next/font/local";
import NextTopLoader from "nextjs-toploader";
import "./globals.css";
import { GlobalInit } from "@/lib/global-init";
import { AnalyticsTracker } from "@/components/analytics-tracker";

const metadataBaseUrl = (() => {
  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    return appUrl ? new URL(appUrl) : new URL("http://localhost:3000");
  } catch {
    return new URL("http://localhost:3000");
  }
})();

export const metadata: Metadata = {
  metadataBase: metadataBaseUrl,
  title: {
    default: "GhostClass | Smart Attendance Tracker",
    template: "%s | GhostClass",
  },
  description: "GhostClass — Survive Attendance!",
  keywords:
    "GhostClass, bunk college, bunk, college attendance, skip lectures, 75% attendance, bunkr, bunk lectures, Bunkr attendance calculator, skip class calculator for college, Bunkr Ezygo alternative, optimize college attendance percentage, Bunkr smart skip strategy, minimum attendance calculator for students, Bunkr class absence planner, how many classes can I skip Bunkr, attendance percentage tracker app, Bunkr vs Ezygo comparison, automate student attendance tracking, Bunkr attendance predictor, avoid attendance shortage Bunkr, college attendance skip allowance, Bunkr attendance optimizer, student absence management app, calculate class skip limit Bunkr, Bunkr attendance analytics dashboard, best app to skip college classes, Bunkr digital roll call system, attendance risk calculator for students",
  creator: "@deva.kesu",
  openGraph: {
    title: "GhostClass | Smart Attendance Tracker",
    description: "GhostClass — Survive Attendance!",
    url: process.env.NEXT_PUBLIC_APP_URL,
    siteName: "GhostClass",
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "GhostClass",
    description: "Bunk college smartly with GhostClass.",
    images: ["/og-image.png"],
  },
};

const klick = localFont({
  src: "../../public/fonts/Klick.woff2",
  variable: "--font-klick",
  display: "swap",
});

const manrope = Manrope({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-manrope",
});

const dmMono = DM_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-dm-mono",
  weight: ["300", "400", "500"],
  style: ["normal", "italic"],
});


export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const gaId = process.env.NEXT_PUBLIC_GA_ID;
  const hasGoogleAnalytics = !!gaId && gaId !== 'undefined' && gaId.startsWith('G-');
  
  return (
    <html lang="en" suppressHydrationWarning data-scroll-behavior="smooth">
      <head>
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <meta name="application-name" content="GhostClass" />
        <meta name="google" content="notranslate" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="msapplication-TileColor" content="#ffffff" />
        <meta name="msapplication-tap-highlight" content="no" />
        <meta name="theme-color" content="#141414" />
      </head>
      <body
        className={`overflow-x-hidden w-full max-w-[100vw] antialiased ${klick.variable} ${manrope.variable} ${dmMono.variable}`}
      >
        {/* Skip Navigation Link for Accessibility */}
        <a 
          href="#main-content" 
          className="sr-only focus:not-sr-only"
        >
          Skip to main content
        </a>
        {/* --- GOOGLE ANALYTICS (Server-side via Measurement Protocol) --- */}
        {hasGoogleAnalytics && (
          <>
            {/* Client-side tracker component - sends events to /api/analytics/track */}
            {/* No gtag.js script needed - bypasses CSP inline script restrictions */}
            <AnalyticsTracker />
          </>
        )}

        <ReactQueryProvider>
          <NextTopLoader 
            color="#a855f7"
            initialPosition={0.08}
            crawlSpeed={200}
            height={3}
            crawl={true}
            showSpinner={false}
            easing="ease"
            speed={200}
            shadow={false}
            zIndex={99999}
          />
          <GlobalInit />
          <main id="main-content" tabIndex={-1}>
            {children}
          </main>
        </ReactQueryProvider>
      </body>
    </html>
  );
}