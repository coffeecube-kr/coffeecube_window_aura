import type { Metadata, Viewport } from "next";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import "./globals.css";
import KioskModeToggle from "./components/KioskModeToggle";
import RobotCodeDisplay from "./components/RobotCodeDisplay";

const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(defaultUrl),
  title: "Coffee Cube Admin | 커피큐브 키오스크",
  description:
    "커피박 수거 시스템 - 키오스크를 통해 커피박을 수거할 수 있습니다.",
  icons: {
    icon: "/logo.svg",
    apple: "/icon-192x192.png",
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "CoffeeCube",
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: "website",
    siteName: "Coffee Cube Kiosk",
    title: "Coffee Cube Admin | 커피큐브 키오스크",
    description:
      "커피박 수거 시스템 - 키오스크를 통해 커피박을 수거할 수 있습니다.",
  },
  twitter: {
    card: "summary",
    title: "Coffee Cube Admin | 커피큐브 키오스크",
    description:
      "커피박 수거 시스템 - 키오스크를 통해 커피박을 수거할 수 있습니다.",
  },
};

export const viewport: Viewport = {
  width: 1080,
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body className="font-pretendard">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <Toaster />
          {/* <KioskModeToggle /> */}
          <RobotCodeDisplay />
          <div className="kiosk-container">{children}</div>
        </ThemeProvider>
      </body>
    </html>
  );
}
