import { Metadata } from "next";
import { Suspense } from "react";
import { Loading } from "@/components/loading";
import ProfileClient from "./ProfileClient";
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