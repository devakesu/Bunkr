import { Metadata } from "next";
import ProfileClient from "./ProfileClient"; 

export const metadata: Metadata = {
  title: "Profile",
  robots: {
    index: false,
    follow: false,
  },
};

export default function ProfilePage() {
  return <ProfileClient />;
}