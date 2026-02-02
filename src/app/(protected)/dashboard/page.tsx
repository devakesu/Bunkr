import { Metadata } from "next";
import DashboardClient from "./DashboardClient";

// Force dynamic rendering for protected routes
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: "Dashboard",
  robots: {
    index: true,
    follow: true,
  },
};

export default function DashboardPage() {
  return <DashboardClient />;
}