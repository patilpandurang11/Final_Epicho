import type { Metadata } from "next";
import { Karla, Playfair_Display } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";
import { ThemeProvider } from "@/components/layout/ThemeProvider";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

const karla = Karla({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-karla",
  display: "swap",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-playfair",
  display: "swap",
});

export const metadata: Metadata = {
  title: "EpiCho — Discover. Create. Cook. Connect.",
  description:
    "All-in-one AI-powered food social network, 9:16 cooking Reels, meal planner, smart grocery lists, heritage preservation, and nutritionist consultations.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${karla.variable} ${playfair.variable}`} suppressHydrationWarning>
      <body className="min-h-screen flex flex-col bg-[#FDFBF7] dark:bg-[#0D1511] text-[#0F172A] dark:text-[#F4F1EA] selection:bg-[#9A3412] selection:text-white transition-colors duration-200">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2 focus:rounded-lg focus:bg-[#059669] focus:text-white focus:font-semibold"
        >
          Skip to main content
        </a>
        <ThemeProvider>
          <AuthProvider>
            <Navbar />
            <main id="main-content" className="flex-1">
              {children}
            </main>
            <Footer />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
