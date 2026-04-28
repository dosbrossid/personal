import type { Metadata } from "next";
import "./globals.css";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "sonner";
import { SWRProvider } from "@/components/providers/SWRProvider";

export const metadata: Metadata = {
  title: "SecondBrain — AI Personal Dashboard",
  description:
    "Sistem manajemen pribadi berbasis AI untuk multi-peran profesional. Satu pintu masuk untuk semua peran Anda.",
  keywords: ["dashboard", "second brain", "AI", "productivity", "personal management"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="id"
      className="h-full antialiased"
      suppressHydrationWarning
      data-scroll-behavior="smooth"
    >
      <body suppressHydrationWarning className="min-h-full flex flex-col">
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
          <SWRProvider>
            <TooltipProvider>{children}</TooltipProvider>
            <Toaster richColors position="top-center" />
          </SWRProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
