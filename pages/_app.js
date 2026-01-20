import "@/styles/globals.css";

import Script from "next/script";
import { ANALYTICS, WALLET } from "@/lib/config";

// Embedded wallet (optional)
import { PrivyProvider } from "@privy-io/react-auth";

function WithAnalytics({ children }) {
  // Google Analytics 4 (optional)
  if (!ANALYTICS.gaId) return children;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${ANALYTICS.gaId}`}
        strategy="afterInteractive"
      />
      <Script id="ga4-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          window.gtag = gtag;
          gtag('js', new Date());
          gtag('config', '${ANALYTICS.gaId}', { anonymize_ip: true });
        `}
      </Script>
      {children}
    </>
  );
}

export default function App({ Component, pageProps }) {
  const privyAppId = WALLET.privyAppId;

  const app = (
    <WithAnalytics>
      <Component {...pageProps} />
    </WithAnalytics>
  );

  // If no Privy App ID is provided, the site still works with MetaMask.
  if (!privyAppId) return app;

  return (
    <PrivyProvider
      appId={privyAppId}
      config={{
        appearance: {
          theme: "dark",
          accentColor: "#00f5ff",
        },
        // Prefer Polygon
        defaultChain: { id: 137, name: "Polygon" },
        supportedChains: [{ id: 137, name: "Polygon" }],
      }}
    >
      {app}
    </PrivyProvider>
  );
}
