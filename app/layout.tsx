import "./globals.css";
import Providers from "./providers";
import type { ReactNode } from "react";

export const metadata = {
  title: "Starbucks Schedule Manager",
  description: "OCR → parse → Google Calendar",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
