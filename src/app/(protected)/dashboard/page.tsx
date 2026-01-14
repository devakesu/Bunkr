import { Metadata } from "next";
import DashboardClient from "./DashboardClient";

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