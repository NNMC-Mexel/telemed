import { Helmet } from 'react-helmet-async'

const SITE_NAME = 'MedConnect ННМЦ'
const BASE_URL = 'https://medconnect.nnmc.kz'
const DEFAULT_IMAGE = `${BASE_URL}/og-image.png`

/**
 * SEOHead — динамические мета-теги для каждой страницы.
 * Использует react-helmet-async (HelmetProvider уже добавлен в main.jsx).
 */
export default function SEOHead({
  title,
  description,
  image = DEFAULT_IMAGE,
  url,
  type = 'website',
  noindex = false,
  structuredData = null,
}) {
  const fullTitle = title ? `${title} | ${SITE_NAME}` : SITE_NAME
  const canonicalUrl = url ? `${BASE_URL}${url}` : BASE_URL

  return (
    <Helmet>
      <title>{fullTitle}</title>
      {description && <meta name="description" content={description} />}
      <link rel="canonical" href={canonicalUrl} />
      {noindex && <meta name="robots" content="noindex, nofollow" />}

      {/* Open Graph */}
      <meta property="og:title" content={fullTitle} />
      {description && <meta property="og:description" content={description} />}
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:type" content={type} />
      <meta property="og:image" content={image} />
      <meta property="og:site_name" content={SITE_NAME} />

      {/* Twitter */}
      <meta name="twitter:title" content={fullTitle} />
      {description && <meta name="twitter:description" content={description} />}
      <meta name="twitter:image" content={image} />

      {/* JSON-LD structured data */}
      {structuredData && (
        <script type="application/ld+json">
          {JSON.stringify(structuredData)}
        </script>
      )}
    </Helmet>
  )
}
