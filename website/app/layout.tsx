import './globals.css';
import Script from 'next/script';
import { Inter } from 'next/font/google';
import ParticlesBackground from '@/components/ParticlesBackground';
import Providers from '@/components/Providers';
import { ThemeProvider } from '@/components/ThemeProvider';
import { THEME_STORAGE_KEY } from '@/lib/theme';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  metadataBase: new URL(process.env.NEXTAUTH_URL || 'https://verification-system-plum.vercel.app'),
  title: 'Paradise',
  description: 'Paradise Private Api',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/icon-16.png', sizes: '16x16', type: 'image/png' },
      { url: '/icon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
  openGraph: {
    title: 'Paradise Private Api',
    description: 'Paradise Private Api',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'Paradise' }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Paradise Private Api',
    description: 'Paradise Private Api',
    images: ['/og-image.png'],
  },
};

const themeBoot = `
(function(){
  try {
    var k=${JSON.stringify(THEME_STORAGE_KEY)};
    var s=localStorage.getItem(k);
    var d=document.documentElement;
    if(s==='dark') d.classList.add('dark');
    else if(s==='light') d.classList.remove('dark');
    else if(window.matchMedia('(prefers-color-scheme:dark)').matches) d.classList.add('dark');
    else d.classList.remove('dark');
  } catch(e) {}
})();`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <Script id="theme-boot" strategy="beforeInteractive">
          {themeBoot}
        </Script>
        <Providers>
          <ThemeProvider>
            <ParticlesBackground />
            <div className="relative z-[1] min-h-screen">{children}</div>
          </ThemeProvider>
        </Providers>
      </body>
    </html>
  );
}
