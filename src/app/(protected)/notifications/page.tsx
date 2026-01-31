import { Metadata } from "next";
import { lazy, Suspense } from "react";
import { Loading } from "@/components/loading";

const NotificationsClient = lazy(() => import("./NotificationsClient"));

export const metadata: Metadata = {
  title: "Notifications",
  robots: {
    index: false,
    follow: false,
  },
};

export default function NotificationsPage() {
  return (
    <Suspense fallback={<Loading />}>
      <NotificationsClient />
    </Suspense>
  );
}