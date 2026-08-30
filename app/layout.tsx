import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://georgefejer91.github.io/cardiac-signals-lab-demo/'),
  title: 'Cardiac Signals Lab — MR Tabletop Previews',
  description:
    'Animated participant-facing previews of six mixed-reality social decision games using visible cardiac-state cues.',
  openGraph: {
    title: 'Cardiac Signals Lab',
    description: 'Six mixed-reality social decision games with visible cardiac-state cues, led by the Market for Lemons.',
    images: ['https://georgefejer91.github.io/cardiac-signals-lab-demo/og.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Cardiac Signals Lab',
    description: 'Six mixed-reality social decision games with visible cardiac-state cues, led by the Market for Lemons.',
    images: ['https://georgefejer91.github.io/cardiac-signals-lab-demo/og.png'],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#080a10',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
