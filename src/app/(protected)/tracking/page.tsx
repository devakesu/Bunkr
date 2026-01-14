import { Metadata } from "next";
import TrackingClient from "./TrackingClient";

export const metadata: Metadata = {
  title: "Tracking",
  robots: {
    index: false,
    follow: false,
  },
};

export default function TrackingPage() {
  return <TrackingClient />;
}