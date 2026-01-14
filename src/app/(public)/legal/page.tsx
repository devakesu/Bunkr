import { Metadata } from "next";
import LegalClient from "./LegalClient";

export const metadata: Metadata = {
  title: "Legal Policies",
  robots: {
    index: true,
    follow: true,
  },
};

export default function LegalPage() {
  return <LegalClient />;
}