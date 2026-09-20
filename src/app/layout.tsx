import type { Metadata, Viewport } from "next";
import "./globals.css";
import Shell from "./shell";

export const metadata: Metadata = {
  title: "ECHO // MEMES",
  description: "Acervo pessoal de memes — o que é, de onde veio e por que funciona.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "ECHO // MEMES",
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
