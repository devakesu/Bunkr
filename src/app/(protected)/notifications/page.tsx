import { Metadata } from "next";
import { Suspense } from "react";
import { Loading } from "@/components/loading";
import dynamic from "next/dynamic";

const NotificationsClient = dynamic(() => import("./NotificationsClient"), {
  ssr: false,
});

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