import './globals.css';

export const metadata = {
  title: 'IST Permit Intel — Tulsa Metro',
  description: 'Construction permit intelligence for NE Oklahoma',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
