import type { Metadata } from "next";
import "./globals.css";
import SvgSprite from "@/components/SvgSprite";

export const metadata: Metadata = {
  title: "Zenith - Productive Task Management",
  description: "A fully functional To-Do List Application with local storage, priority levels, subtasks, dark mode, and customizable notifications.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <SvgSprite />
        {children}
      </body>
    </html>
  );
}
