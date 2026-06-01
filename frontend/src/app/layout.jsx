import './globals.css';
export const metadata = { title: 'ImobPro', description: 'Sistema de prospecção imobiliária' };
export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
