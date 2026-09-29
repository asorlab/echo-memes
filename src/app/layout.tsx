import type { Metadata, Viewport } from "next";
import "./globals.css";
import Shell from "./shell";

export const metadata: Metadata = {
  title: "ECHO // ASSETS",
  description: "Biblioteca criativa — memes, SFX, áudios, overlays e tudo que acelera a edição.",
  icons: {
    icon: "/favicon.svg",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "ECHO // ASSETS",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
