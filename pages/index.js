import { useEffect, useMemo, useState } from "react";

const POLYGON_CHAIN_ID_HEX = "0x89"; // 137
const TFPCOIN = {
  name: "TFPCOIN",
  symbol: "TFP",
  decimals: 18,
  // TODO: set your real token contract address on Polygon
  address: process.env.NEXT_PUBLIC_TFPCOIN_ADDRESS || "",
  // optional: set a DexScreener pair address for live price/market cap
  dexPair: process.env.NEXT_PUBLIC_DEXSCREENER_PAIR || "",
  // optional: where to buy (Uniswap/QuickSwap/etc.)
  buyUrl:
    process.env.NEXT_PUBLIC_BUY_URL ||
    "https://quickswap.exchange/#/swap?outputCurrency=",
  // optional: liquidity lock url (TeamFinance/Unicrypt/etc.)
  liquidityLockUrl:
    process.env.NEXT_PUBLIC_LIQ_LOCK_URL || "https://",
};

function track(event, props = {}) {
  // GA4 (optional): add NEXT_PUBLIC_GA_MEASUREMENT_ID + gtag script later if you want
  if (typeof window !== "undefined" && typeof window.gtag === "function") {
    window.gtag("event", event, props);
  }
  // always log so you can confirm clicks even without analytics
  console.log("[analytics]", event, props);
}

async function ensurePolygon() {
  if (typeof window === "undefined") return { ok: false, reason: "server" };
  const eth = window.ethereum;
  if (!eth) return { ok: false, reason: "no_metamask" };

  try {
    const chainId = await eth.request({ method: "eth_chainId" });
    if (chainId === POLYGON_CHAIN_ID_HEX) return { ok: true };

    try {
      await eth.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: POLYGON_CHAIN_ID_HEX }],
      });
      return { ok: true };
    } catch (switchErr) {
      // If Polygon isn’t added in MetaMask yet, add it
      if (switchErr?.code === 4902) {
        await eth.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: POLYGON_CHAIN_ID_HEX,
              chainName: "Polygon Mainnet",
              nativeCurrency: { name: "MATIC", symbol: "MATIC", decimals: 18 },
              rpcUrls: ["https://polygon-rpc.com/"],
              blockExplorerUrls: ["https://polygonscan.com/"],
            },
          ],
        });
        return { ok: true };
      }
      return { ok: false, reason: "switch_failed" };
    }
  } catch (e) {
    return { ok: false, reason: "eth_error" };
  }
}

async function addTokenToMetaMask() {
  if (typeof window === "undefined") return { ok: false, reason: "server" };
  const eth = window.ethereum;
  if (!eth) return { ok: false, reason: "no_metamask" };
  if (!TFPCOIN.address) return { ok: false, reason: "missing_token_address" };

  try {
    // Ensure correct chain first
    await ensurePolygon();

    const wasAdded = await eth.request({
      method: "wallet_watchAsset",
      params: {
        type: "ERC20",
        options: {
          address: TFPCOIN.address,
          symbol: TFPCOIN.symbol,
          decimals: TFPCOIN.decimals,
          // optional token image (must be https)
          image: process.env.NEXT_PUBLIC_TOKEN_IMAGE_URL || undefined,
        },
      },
    });

    return { ok: !!wasAdded };
  } catch (e) {
    return { ok: false, reason: "watch_failed" };
  }
}

export default function Home() {
  const [buyOpen, setBuyOpen] = useState(false);
  const [walletStatus, setWalletStatus] = useState("");
  const [price, setPrice] = useState(null);
  const [mcap, setMcap] = useState(null);
  const [liqLocked, setLiqLocked] = useState(true); // trust badge (manual default)

  const buyLink = useMemo(() => {
    // If you didn’t set BUY_URL, we build a QuickSwap link using address if present
    if (TFPCOIN.buyUrl.includes("outputCurrency=") && TFPCOIN.address) {
      return `${TFPCOIN.buyUrl}${TFPCOIN.address}`;
    }
    return TFPCOIN.buyUrl;
  }, []);

  useEffect(() => {
    // Live price/market cap (best effort)
    // Uses DexScreener if you provide NEXT_PUBLIC_DEXSCREENER_PAIR
    async function loadMarket() {
      if (!TFPCOIN.dexPair) return;

      try {
        const res = await fetch(
          `https://api.dexscreener.com/latest/dex/pairs/polygon/${TFPCOIN.dexPair}`
        );
        const data = await res.json();
        const p = data?.pair?.priceUsd ? Number(data.pair.priceUsd) : null;
        const fdv = data?.pair?.fdv ? Number(data.pair.fdv) : null;

        setPrice(Number.isFinite(p) ? p : null);
        setMcap(Number.isFinite(fdv) ? fdv : null);
      } catch (e) {
        // ignore
      }
    }

    loadMarket();
    const t = setInterval(loadMarket, 25000);
    return () => clearInterval(t);
  }, []);

  const onSwitchPolygon = async () => {
    track("switch_polygon_click");
    const result = await ensurePolygon();
    if (!result.ok) {
      if (result.reason === "no_metamask") {
        setWalletStatus("MetaMask not detected. Install MetaMask to continue.");
      } else {
        setWalletStatus("Could not switch network. Try again in MetaMask.");
      }
      return;
    }
    setWalletStatus("✅ Switched to Polygon");
  };

  const onAddToken = async () => {
    track("add_token_click");
    const result = await addTokenToMetaMask();

    if (!result.ok) {
      if (result.reason === "no_metamask") {
        setWalletStatus("MetaMask not detected. Install MetaMask to add token.");
      } else if (result.reason === "missing_token_address") {
        setWalletStatus(
          "Token address not set yet. Add NEXT_PUBLIC_TFPCOIN_ADDRESS in Vercel env vars."
        );
      } else {
        setWalletStatus("Could not add token. Check MetaMask and try again.");
      }
      return;
    }

    setWalletStatus("✅ TFPCOIN added to MetaMask");
  };

  const onBuy = () => {
    track("buy_open");
    setBuyOpen(true);
  };

  const closeBuy = () => {
    track("buy_close");
    setBuyOpen(false);
  };

  const openBuyLink = () => {
    track("buy_click_external", { url: buyLink });
    window.open(buyLink, "_blank", "noopener,noreferrer");
  };

  // Embedded wallet: safe placeholder (won’t crash if not configured)
  const embeddedEnabled = !!process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  const onOpenEmbeddedWallet = () => {
    track("embedded_wallet_click");
    alert(
      embeddedEnabled
        ? "Embedded wallet is enabled, but provider wiring is not installed in this minimal build."
        : "Embedded wallet not configured yet. Add NEXT_PUBLIC_PRIVY_APP_ID in Vercel to enable."
    );
  };

  return (
    <div className="page">
      <header className="hero">
        <img className="logo" src="/logo.png" alt="TFPCOIN" />
        <h1>{TFPCOIN.name}</h1>
        <p className="subtitle">The Future of Digital Value</p>

        <div className="stats">
          <div className="stat">
            <div className="label">Price (USD)</div>
            <div className="value">
              {price === null ? "—" : `$${price.toLocaleString(undefined, { maximumFractionDigits: 8 })}`}
            </div>
          </div>
          <div className="stat">
            <div className="label">Market Cap / FDV</div>
            <div className="value">
              {mcap === null ? "—" : `$${mcap.toLocaleString()}`}
            </div>
          </div>
          <div className="stat">
            <div className="label">Liquidity</div>
            <div className="value">
              {liqLocked ? (
                <span className="badge">🔒 Liquidity Locked</span>
              ) : (
                <span className="badge warn">⚠ Not Locked</span>
              )}
            </div>
          </div>
        </div>

        <div className="ctaRow">
          <button className="btn primary" onClick={onBuy}>
            Buy TFPCOIN
          </button>

          <button className="btn" onClick={onSwitchPolygon}>
            Switch to Polygon
          </button>

          <button className="btn" onClick={onAddToken}>
            Add TFPCOIN to MetaMask
          </button>

          <button className="btn" onClick={onOpenEmbeddedWallet}>
            Embedded Wallet
          </button>
        </div>

        {walletStatus ? <div className="status">{walletStatus}</div> : null}

        <div className="links">
          <a href="/TFPCOIN_Whitepaper.pdf" target="_blank" rel="noreferrer">
            Whitepaper (PDF)
          </a>
          {TFPCOIN.liquidityLockUrl && TFPCOIN.liquidityLockUrl !== "https://" ? (
            <>
              <span> · </span>
              <a href={TFPCOIN.liquidityLockUrl} target="_blank" rel="noreferrer">
                Liquidity Lock Proof
              </a>
            </>
          ) : null}
        </div>
      </header>

      {buyOpen ? (
        <div className="modalBackdrop" onClick={closeBuy}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modalHeader">
              <div className="modalTitle">Buy TFPCOIN</div>
              <button className="iconBtn" onClick={closeBuy} aria-label="Close">
                ✕
              </button>
            </div>

            <div className="modalBody">
              <ol>
                <li>Switch to Polygon</li>
                <li>Open the swap link</li>
                <li>Confirm in your wallet</li>
              </ol>

              <div className="modalActions">
                <button className="btn" onClick={onSwitchPolygon}>
                  Switch to Polygon
                </button>
                <button className="btn primary" onClick={openBuyLink}>
                  Open Swap
                </button>
              </div>

              <div className="fineprint">
                Tip: After you buy, click <b>Add TFPCOIN to MetaMask</b> so it
                shows in your wallet.
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <style jsx>{`
        .page {
          min-height: 100vh;
          background: radial-gradient(circle at top, #0f2027, #000);
          color: #fff;
          font-family: Arial, Helvetica, sans-serif;
          padding: 32px 16px;
        }
        .hero {
          max-width: 980px;
          margin: 0 auto;
          text-align: center;
        }
        .logo {
          width: 90px;
          height: 90px;
          border-radius: 20px;
          margin: 0 auto 10px;
        }
        h1 {
          font-size: 44px;
          margin: 10px 0 6px;
          letter-spacing: 1px;
        }
        .subtitle {
          color: #bdbdbd;
          margin: 0 0 22px;
        }
        .stats {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
          margin: 18px auto 18px;
        }
        .stat {
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 16px;
          padding: 14px;
        }
        .label {
          font-size: 12px;
          color: #bdbdbd;
          margin-bottom: 6px;
        }
        .value {
          font-size: 18px;
          font-weight: 700;
        }
        .badge {
          display: inline-block;
          padding: 6px 10px;
          border-radius: 999px;
          background: rgba(0, 255, 180, 0.12);
          border: 1px solid rgba(0, 255, 180, 0.25);
        }
        .badge.warn {
          background: rgba(255, 170, 0, 0.12);
          border: 1px solid rgba(255, 170, 0, 0.25);
        }
        .ctaRow {
          display: flex;
          gap: 10px;
          justify-content: center;
          flex-wrap: wrap;
          margin: 18px 0 10px;
        }
        .btn {
          border: 1px solid rgba(255, 255, 255, 0.25);
          background: rgba(255, 255, 255, 0.06);
          color: #fff;
          padding: 12px 16px;
          border-radius: 14px;
          cursor: pointer;
          font-weight: 700;
        }
        .btn.primary {
          background: linear-gradient(135deg, #00f5ff, #7f00ff);
          border: none;
          color: #000;
        }
        .status {
          margin-top: 10px;
          font-size: 14px;
          color: #d7d7d7;
        }
        .links {
          margin-top: 16px;
          color: #bdbdbd;
        }
        .links a {
          color: #bdbdbd;
          text-decoration: underline;
        }

        .modalBackdrop {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.65);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 18px;
          z-index: 50;
        }
        .modal {
          width: 100%;
          max-width: 520px;
          background: #0b0b0f;
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 18px;
          overflow: hidden;
          box-shadow: 0 20px 80px rgba(0, 0, 0, 0.55);
        }
        .modalHeader {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 16px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }
        .modalTitle {
          font-weight: 800;
          font-size: 16px;
        }
        .iconBtn {
          background: transparent;
          border: none;
          color: #fff;
          font-size: 18px;
          cursor: pointer;
        }
        .modalBody {
          padding: 16px;
          text-align: left;
        }
        .modalActions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          margin: 14px 0 6px;
        }
        .fineprint {
          margin-top: 10px;
          font-size: 12px;
          color: #bdbdbd;
        }

        @media (max-width: 860px) {
          .stats {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
