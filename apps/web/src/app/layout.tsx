import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'
import Footer from '@/components/Footer'
import { Header } from '@/components/Header'
import { Toaster } from '@/components/ui/toaster'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Super Seller IA',
  description: 'Plataforma de IA para otimizar anúncios em marketplaces',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "SuperSeller IA",
    "url": "https://app.superselleria.com.br",
    "sameAs": [
      "https://superselleria.com.br"
    ],
    "contactPoint": [{
      "@type": "ContactPoint",
      "email": "suporte@superselleria.com.br",
      "contactType": "customer support",
      "availableLanguage": "Portuguese"
    }]
  };

  return (
    <html lang="pt-BR">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(structuredData),
          }}
        />
      </head>
      <body className={inter.className}>
                <Providers>
                  <div className="min-h-screen bg-background flex flex-col">
                    <Header />
                    <main className="container mx-auto px-4 py-8 flex-1">
                      {children}
                    </main>
                    <Footer />
                  </div>
                  <Toaster />
                </Providers>
      </body>
    </html>
  )
}
