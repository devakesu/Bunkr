import { Metadata } from "next";
import HelpClient from "./HelpClient";

export const metadata: Metadata = {
  title: "Help & FAQ",
  robots: {
    index: true,
    follow: true,
  },
};

export default function HelpPage() {
  return <HelpClient />;
}
