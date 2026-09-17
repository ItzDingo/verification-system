import './globals.css';
import Script from 'next/script';
import { Inter } from 'next/font/google';
import ParticlesBackground from '@/components/ParticlesBackground';
import Providers from '@/components/Providers';
import { ThemeProvider } from '@/components/ThemeProvider';
import { THEME_STORAGE_KEY } from '@/lib/theme';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'Staff Portal',
  description: 'Internal Staff Management System',
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
