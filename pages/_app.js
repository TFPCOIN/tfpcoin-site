import "../styles/globals.css";

// OPTIONAL Privy support (will NOT crash if not installed or not configured)
// If you want Privy later, you can install it and then uncomment the provider section below.
export default function App({ Component, pageProps }) {
  return <Component {...pageProps} />;
}
