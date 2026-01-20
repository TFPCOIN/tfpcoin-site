import Head from "next/head";
import { useEffect, useMemo, useState } from "react";

import { TOKEN, WALLET, LINKS } from "@/lib/config";
import { trackEvent } from '../lib/analytics'

// Privy embedded wallet (optional)
import { usePrivy } from "@privy-io/react-auth";

// Web3Auth (optional)
import { Web3Auth } from "@web3auth/modal";
import { CHAIN_NAMESPACES } from "@web3auth/base";

function formatMoney(v) {
  const n = Number(v);
  if (!isFinite(n)) return "—";
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(2)}K`;
  return `$${n.toFixed(2)}`;
}

function Modal({ open, title, onClose, children }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="modalOverlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="modalCard" onClick={(e) => e.stopPropagation()}>
        <div className="modalHeader">
          <div style={{ fontWeight: 700 }}>{title}</div>
          <button className="iconBtn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function Home() {
  // Privy (optional)
  const privyEnabled = Boolean(process.env.NEXT_PUBLIC_PRIVY_APP_ID);
  const { ready, authenticated, user, login, logout } = usePrivy();

  // Web3Auth (optional)
  const web3AuthEnabled = Boolean(process.env.NEXT_PUBLIC_WEB3AUTH_CLIENT_ID);
  const [web3auth, setWeb3auth] = useState(null);
  const [web3authAddress, setWeb3authAddress] = useState("");

  const [walletAddress, setWalletAddress] = useState("");
  const [buyOpen, setBuyOpen] = useState(false);
  const [price, setPrice] = useState(null);
  const [mcap, setMcap] = useState(null);
  const [statsStatus, setStatsStatus] = useState("loading");

  const quickswapUrl = useMemo(() => {
    const addr = TOKEN.address;
    return `https://quickswap.exchange/#/swap?outputCurrency=${addr}`;
  }, []);

  const chartUrl = useMemo(() => {
    const addr = TOKEN.address;
    return `https://dexscreener.com/polygon/${addr}`;
  }, []);

  async function connectMetaMask() {
    if (typeof window === "undefined" || !window.ethereum) {
      alert("MetaMask not detected. Please install MetaMask.");
      return;
    }
    try {
      track("connect_wallet_click", { wallet: "metamask" });
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      const addr = accounts?.[0] || "";
      setWalletAddress(addr);
      track("connect_wallet_success", { wallet: "metamask" });
      await switchToPolygon();
    } catch (e) {
      track("connect_wallet_error", { wallet: "metamask" });
      alert("Connection request rejected.");
    }
  }

  async function switchToPolygon() {
    if (typeof window === "undefined" || !window.ethereum) return;
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: WALLET.polygon.chainId }],
      });
      track("switch_network_success", { chain: "polygon" });
    } catch (switchError) {
      // 4902 = unknown chain
      if (switchError?.code === 4902) {
        try {
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [WALLET.polygon],
          });
          track("add_chain_success", { chain: "polygon" });
        } catch (addError) {
          track("add_chain_error", { chain: "polygon" });
          alert("Could not add Polygon network.");
        }
      } else {
        track("switch_network_error", { chain: "polygon" });
      }
    }
  }

  async function addTokenToMetaMask() {
    if (typeof window === "undefined" || !window.ethereum) {
      alert("MetaMask not detected.");
      return;
    }
    try {
      await switchToPolygon();
      const tokenImage = `${window.location.origin}/logo.png`;
      track("watch_asset_click", { symbol: TOKEN.symbol });
      const wasAdded = await window.ethereum.request({
        method: "wallet_watchAsset",
        params: {
          type: "ERC20",
          options: {
            address: TOKEN.address,
            symbol: TOKEN.symbol,
            decimals: TOKEN.decimals,
            image: tokenImage,
          },
        },
      });
      if (wasAdded) track("watch_asset_success", { symbol: TOKEN.symbol });
    } catch (e) {
      track("watch_asset_error", { symbol: TOKEN.symbol });
      alert("Could not add TFPCOIN to MetaMask.");
    }
  }

  function openBuy() {
    track("buy_open", { source: "header" });
    setBuyOpen(true);
  }

  function closeBuy() {
    track("buy_close", { source: "modal" });
    setBuyOpen(false);
  }

  // DexScreener stats (client-side)
  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        setStatsStatus("loading");
        const r = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${TOKEN.address}`);
        const j = await r.json();
        const pair = j?.pairs?.[0];
        const p = pair?.priceUsd ? Number(pair.priceUsd) : null;
        // DexScreener may provide marketCap or fdv depending on pair
        const mc = pair?.marketCap ?? pair?.fdv ?? null;
        if (!mounted) return;
        setPrice(p);
        setMcap(mc ? Number(mc) : null);
        setStatsStatus("ready");
      } catch {
        if (!mounted) return;
        setStatsStatus("error");
      }
    }
    load();
    const t = setInterval(load, 60_000);
    return () => {
      mounted = false;
      clearInterval(t);
    };
  }, []);

  // Web3Auth init (optional)
  useEffect(() => {
    if (!web3AuthEnabled) return;
    let cancelled = false;
    (async () => {
      try {
        const clientId = process.env.NEXT_PUBLIC_WEB3AUTH_CLIENT_ID;
        if (!clientId) return;
        const w3a = new Web3Auth({
          clientId,
          web3AuthNetwork: "sapphire_mainnet",
          chainConfig: {
            chainNamespace: CHAIN_NAMESPACES.EIP155,
            chainId: WALLET.polygon.chainId,
            rpcTarget: WALLET.polygon.rpcUrls?.[0],
            displayName: "Polygon",
            blockExplorerUrl: WALLET.polygon.blockExplorerUrls?.[0],
            ticker: "POL",
            tickerName: "Polygon",
          },
        });
        await w3a.initModal();
        if (cancelled) return;
        setWeb3auth(w3a);
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [web3AuthEnabled]);

  async function loginWeb3Auth() {
    if (!web3auth) return;
    try {
      track("connect_wallet_click", { wallet: "web3auth" });
      const provider = await web3auth.connect();
      // get accounts via eth_accounts
      const accounts = await provider.request({ method: "eth_accounts" });
      const addr = accounts?.[0] || "";
      setWeb3authAddress(addr);
      track("connect_wallet_success", { wallet: "web3auth" });
    } catch {
      track("connect_wallet_error", { wallet: "web3auth" });
    }
  }

  async function logoutWeb3Auth() {
    if (!web3auth) return;
    await web3auth.logout();
    setWeb3authAddress("");
  }

  const displayWallet = useMemo(() => {
    if (authenticated && user?.wallet?.address) return user.wallet.address;
    if (web3authAddress) return web3authAddress;
    return walletAddress;
  }, [authenticated, user, walletAddress, web3authAddress]);

  const liquidityLabel = process.env.NEXT_PUBLIC_LIQ_LOCK_LABEL || "Liquidity Lock";
  const liquidityUrl = process.env.NEXT_PUBLIC_LIQ_LOCK_URL || "";

  return (
    <>
      <Head>
        <title>TFPCOIN | The Future of Digital Value</title>
        <meta name="description" content="TFPCOIN — The Future of Digital Value." />
        <link rel="icon" type="image/png" href="/favicon.png" />
      </Head>

      <header className="header">
        <img src="/logo.png" alt="TFPCOIN Logo" style={{ maxWidth: 220, marginBottom: 18 }} />
        <h1 className="title">TFPCOIN</h1>
        <p className="subtitle">
          The Future of Digital Value. A next-generation Web3 ecosystem built for speed, transparency, and community
          ownership.
        </p>

        <div className="row" style={{ gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
          <a className="cta" href="#tokenomics">
            Tokenomics
          </a>
          <a className="cta" href="#roadmap">
            Roadmap
          </a>
          <a className="cta" href="#whitepaper">
            Whitepaper
          </a>
          <button className="cta" onClick={openBuy}>
            Buy TFPCOIN
          </button>
          <a className="cta" href={chartUrl} target="_blank" rel="noopener">
            View Chart
          </a>
        </div>

        <div className="row" style={{ gap: 10, flexWrap: "wrap", justifyContent: "center", marginTop: 14 }}>
          <button className="ctaSecondary" onClick={addTokenToMetaMask}>
            Add TFPCOIN to MetaMask
          </button>
          <button className="ctaSecondary" onClick={switchToPolygon}>
            Switch to Polygon
          </button>

          {/* Wallet buttons */}
          <button className="ctaSecondary" onClick={connectMetaMask}>
            Connect MetaMask
          </button>

          {privyEnabled && (
            <button
              className="ctaSecondary"
              disabled={!ready}
              onClick={() => {
                track("connect_wallet_click", { wallet: "privy" });
                authenticated ? logout() : login();
              }}
            >
              {authenticated ? "Logout (Privy)" : "Login (Privy)"}
            </button>
          )}

          {web3AuthEnabled && (
            <button className="ctaSecondary" onClick={web3authAddress ? logoutWeb3Auth : loginWeb3Auth}>
              {web3authAddress ? "Logout (Web3Auth)" : "Login (Web3Auth)"}
            </button>
          )}
        </div>

        {displayWallet && <p className="wallet">Connected: {displayWallet}</p>}

        <div className="stats">
          <div className="stat">
            <div className="statLabel">Price</div>
            <div className="statValue">{statsStatus === "ready" ? formatMoney(price) : "—"}</div>
          </div>
          <div className="stat">
            <div className="statLabel">Market Cap</div>
            <div className="statValue">{statsStatus === "ready" ? formatMoney(mcap) : "—"}</div>
          </div>
          <div className="stat">
            <div className="statLabel">Network</div>
            <div className="statValue">Polygon</div>
          </div>
          <div className="stat">
            <div className="statLabel">{liquidityLabel}</div>
            <div className="statValue">
              {liquidityUrl ? (
                <a href={liquidityUrl} target="_blank" rel="noopener" style={{ color: "#00f5ff" }}>
                  View
                </a>
              ) : (
                <span style={{ color: "#b3b3b3" }}>Not verified</span>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="container">
        <section id="about">
          <h2>About TFPCOIN</h2>
          <p style={{ textAlign: "center", maxWidth: 800, margin: "0 auto" }}>
            TFPCOIN is a decentralized digital asset designed to empower creators, investors, and communities through
            secure blockchain technology. Built with scalability and accessibility in mind, TFPCOIN bridges innovation and
            real-world utility.
          </p>
        </section>

        <section id="contract">
          <h2>Contract & Links</h2>
          <div className="card" style={{ maxWidth: 860, margin: "0 auto" }}>
            <p style={{ margin: "0 0 10px 0" }}>
              <strong>Network:</strong> Polygon (POL)
            </p>
            <p style={{ margin: "0 0 10px 0" }}>
              <strong>TFPCOIN Contract:</strong>
            </p>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <code className="code" style={{ flex: 1, minWidth: 260 }}>
                {TOKEN.address}
              </code>
              <button
                className="ctaSecondary"
                style={{ width: "auto", padding: "12px 16px" }}
                onClick={() => {
                  navigator.clipboard.writeText(TOKEN.address);
                  track("copy_contract", { token: TOKEN.symbol });
                }}
              >
                Copy
              </button>
              <a className="ctaSecondary" href={LINKS.blockExplorer} target="_blank" rel="noopener">
                Block Explorer
              </a>
            </div>
            <p style={{ margin: "12px 0 0 0", color: "#b3b3b3" }}>
              Use the Buy modal (above) to swap into TFPCOIN. If your phone blocks the embedded swap, tap “Open in
              QuickSwap” inside the modal.
            </p>
          </div>
        </section>

        <section id="tokenomics">
          <h2>Tokenomics</h2>
          <div className="grid">
            <div className="card">
              <strong>Total Supply:</strong>
              <br />
              1,000,000,000 TFPC
            </div>
            <div className="card">
              <strong>Liquidity:</strong>
              <br />
              40%
            </div>
            <div className="card">
              <strong>Community & Rewards:</strong>
              <br />
              30%
            </div>
            <div className="card">
              <strong>Team & Development:</strong>
              <br />
              20%
            </div>
            <div className="card">
              <strong>Marketing:</strong>
              <br />
              10%
            </div>
          </div>
        </section>

        <section id="roadmap">
          <h2>Roadmap</h2>
          <div className="card">
            <div style={{ marginBottom: 20 }}>
              <strong>Phase 1:</strong> Brand launch, website, smart contract deployment
            </div>
            <div style={{ marginBottom: 20 }}>
              <strong>Phase 2:</strong> Community growth, liquidity launch, marketing push
            </div>
            <div style={{ marginBottom: 20 }}>
              <strong>Phase 3:</strong> Exchange listings, partnerships, staking utility
            </div>
            <div style={{ marginBottom: 0 }}>
              <strong>Phase 4:</strong> Ecosystem expansion & governance
            </div>
          </div>
        </section>

        <section id="whitepaper">
          <h2>Whitepaper</h2>
          <p style={{ textAlign: "center" }}>
            Download the official TFPCOIN whitepaper to explore the full vision, utility, and technical framework.
          </p>
          <div style={{ textAlign: "center" }}>
            <a className="cta" href="/TFPCOIN_Whitepaper.pdf" target="_blank" rel="noopener">
              Download Whitepaper (PDF)
            </a>
          </div>
        </section>

        <section id="newsletter">
          <h2>Join the Community</h2>
          <div className="card" style={{ maxWidth: 420, margin: "0 auto" }}>
            <form action="https://formspree.io/f/xyzzabcd" method="POST">
              <input type="email" name="email" placeholder="Enter your email" required />
              <button
                type="submit"
                onClick={() => track("waitlist_submit_click")}
              >
                Join Waitlist
              </button>
            </form>
          </div>
        </section>
      </main>

      <footer className="footer">© {new Date().getFullYear()} TFPCOIN. All Rights Reserved. | Web3 Powered</footer>

      <Modal open={buyOpen} title="Buy TFPCOIN" onClose={closeBuy}>
        <div style={{ padding: 16 }}>
          <p style={{ marginTop: 0, color: "#b3b3b3" }}>
            Connect your wallet inside the widget and swap into {TOKEN.symbol} on Polygon.
          </p>

          <div className="modalBody">
            <iframe
              title="Buy TFPCOIN"
              src={quickswapUrl}
              style={{ width: "100%", height: 640, border: 0, borderRadius: 16 }}
              allow="clipboard-read; clipboard-write"
            />
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
            <button
              className="cta"
              style={{ border: 0 }}
              onClick={async () => {
                await switchToPolygon();
                await connectMetaMask();
              }}
            >
              Connect MetaMask
            </button>
            <a className="cta" href={quickswapUrl} target="_blank" rel="noopener">
              Open in QuickSwap
            </a>
            <a className="cta" href={chartUrl} target="_blank" rel="noopener">
              View Chart
            </a>
          </div>

          <p style={{ marginBottom: 0, marginTop: 12, color: "#777", fontSize: 13 }}>
            Note: your purchase happens on QuickSwap/Polygon. This site doesn’t hold your funds.
          </p>
        </div>
      </Modal>

      <style jsx>{`
        .container {
          max-width: 1100px;
          margin: 0 auto;
          padding: 0 16px 80px;
        }

        header {
          padding: 40px 0 10px;
          text-align: center;
        }

        .logo {
          width: 220px;
          height: auto;
          margin-bottom: 18px;
        }

        .subtitle {
          max-width: 760px;
          margin: 0 auto 16px;
          color: #b3b3b3;
        }

        .topRow {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
        }

        .pill {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          padding: 10px 14px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.08);
        }

        .pillTitle {
          font-weight: 700;
        }

        .pillValue {
          color: #b3b3b3;
        }

        .ctaButtons {
          margin: 18px 0 10px;
          display: flex;
          justify-content: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .cta {
          display: inline-block;
          padding: 14px 22px;
          border-radius: 999px;
          text-decoration: none;
          font-weight: 800;
          background: linear-gradient(135deg, #00f5ff, #7f00ff);
          color: #000;
        }

        .ctaSecondary {
          background: rgba(255, 255, 255, 0.08);
          color: #fff;
          border: 1px solid rgba(255, 255, 255, 0.12);
        }

        .ctaLink {
          background: transparent;
          border: 1px solid rgba(255, 255, 255, 0.12);
          color: #fff;
        }

        section {
          padding: 48px 0 0;
        }

        h2 {
          text-align: center;
          margin: 0 0 12px;
        }

        .card {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 20px;
          padding: 16px;
        }

        .statsGrid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }

        .stat {
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 16px;
          padding: 12px;
        }

        .statLabel {
          color: #b3b3b3;
          font-size: 12px;
          margin-bottom: 6px;
        }

        .statValue {
          font-weight: 800;
          font-size: 18px;
        }

        .badgeRow {
          display: flex;
          gap: 10px;
          justify-content: center;
          flex-wrap: wrap;
        }

        .badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 12px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.10);
        }

        .badgeLabel {
          color: #b3b3b3;
          font-size: 12px;
        }

        .badgeStrong {
          font-weight: 800;
        }

        input,
        button {
          width: 100%;
          padding: 12px;
          border-radius: 10px;
          border: none;
          margin-top: 10px;
          font-size: 14px;
        }

        button {
          background: linear-gradient(135deg, #00f5ff, #7f00ff);
          font-weight: 800;
          cursor: pointer;
        }

        .footer {
          text-align: center;
          padding: 30px 16px;
          color: #777;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
        }

        @media (max-width: 740px) {
          .statsGrid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </>
  );
}
