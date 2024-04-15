import type {Metadata} from "next";
import {Inter} from "next/font/google";
import "./globals.css";

const inter = Inter({subsets: ["latin"]});

export const metadata: Metadata = {
  title: "SkyWay Media Analytics Realtime",
  description: "SkyWay Media Analytics Realtime",
  robots: {
    index: false,
  },
};
const Header = () => {
  return (
    <header className="bg-blue-500 text-white text-lg p-4">
      Call Analytics
    </header>
  );
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en">
      <body className={inter.className + " h-screen"}>
        <Header />
        <main className="p-8">{children}</main>
      </body>
    </html>
  );
}
