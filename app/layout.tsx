import type { Metadata } from "next";
import { ThemeProvider } from "next-themes";
import "./globals.css";

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
    },
  };

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body className="w-full h-full font-pretendard">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
