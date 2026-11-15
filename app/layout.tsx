import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Terra Analog Mission Control",
  description:
    "Explore Earth–Mars terrain similarity with transparent data sources and model limitations. Not a landing-site recommendation.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
