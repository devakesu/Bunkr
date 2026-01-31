import { Metadata } from "next";
import { lazy, Suspense } from "react";
import { Loading } from "@/components/loading";

const ProfileClient = lazy(() => import("./ProfileClient")); 

export const metadata: Metadata = {
  title: "Profile",
  robots: {
    index: false,
    follow: false,
  },
};

export default function ProfilePage() {
  return (
    <Suspense fallback={<Loading />}>
      <ProfileClient />
    </Suspense>
  );
}