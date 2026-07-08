import { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    template: "DevPilot - Playground",
    default: "DevPilot - Advanced Interactive Code Playground",
  },
};

export default function HomeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
