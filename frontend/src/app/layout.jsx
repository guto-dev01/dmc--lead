import './globals.css';

export const metadata = {
  title: 'ImobPro — Captação de Leads',
  description: 'ImobPro — captação de leads e prospecção (imobiliária, corporativa e funerária)',
  icons: { icon: '/imobpro-logo.png' },
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700&family=Geist+Mono:wght@400;500;600&display=swap"
        />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
