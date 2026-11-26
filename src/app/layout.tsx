import type { Metadata } from 'next';
import { DM_Sans, JetBrains_Mono, Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-jakarta',
  display: 'swap',
});

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-dm-sans',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'GitHub Talker',
  description:
    'Interactive codebase intelligence workspace to ingest, explore, and chat with any public GitHub repository using semantic retrieval and grounded code citations.',
  openGraph: {
    title: 'GitHub Talker',
    description:
      'Interactive codebase intelligence workspace to ingest, explore, and chat with any public GitHub repository using semantic retrieval and grounded code citations.',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`dark ${plusJakartaSans.variable} ${dmSans.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-screen bg-white text-slate-900 dark:bg-[#0B1120] dark:text-slate-100 antialiased selection:bg-blue-600/20 selection:text-blue-700 dark:selection:bg-blue-500/30 dark:selection:text-blue-200">
        {children}
      </body>
    </html>
  );
}
