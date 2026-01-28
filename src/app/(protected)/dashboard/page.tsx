import { Metadata } from "next";
import { lazy } from "react";

const DashboardClient = lazy(() => import('./DashboardClient'));

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