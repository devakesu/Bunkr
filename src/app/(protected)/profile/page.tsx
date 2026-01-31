import { Metadata } from "next";
import { Suspense } from "react";
import { Loading } from "@/components/loading";
import dynamic from "next/dynamic";

const ProfileClient = dynamic(() => import("./ProfileClient"), {
  ssr: false,
});
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