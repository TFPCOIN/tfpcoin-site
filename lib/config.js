// Centralized config for TFPCOIN site

export const TOKEN = {
  // Polygon token contract
  address: process.env.NEXT_PUBLIC_TOKEN_ADDRESS || "0x59EB0583C532c0EF4e887308d8D477e48d02f7F8",
  symbol: process.env.NEXT_PUBLIC_TOKEN_SYMBOL || "TFPC",
  // If you know decimals, set NEXT_PUBLIC_TOKEN_DECIMALS. 18 is most common.
  decimals: Number(process.env.NEXT_PUBLIC_TOKEN_DECIMALS || 18),
  // Optional: image shown inside MetaMask add-token flow
  imagePath: process.env.NEXT_PUBLIC_TOKEN_IMAGE_PATH || "/logo.png",
};

export const NETWORKS = {
  polygon: {
    chainIdHex: "0x89", // 137
    chainId: 137,
    chainName: "Polygon Mainnet",
    nativeCurrency: { name: "POL", symbol: "POL", decimals: 18 },
    rpcUrls: [
      // Public RPCs can rate-limit. Replace with your own if needed.
      "https://polygon-rpc.com",
      "https://rpc.ankr.com/polygon",
    ],
    blockExplorerUrls: ["https://polygonscan.com"],
  },
};

export const LINKS = {
  quickswapSwapBase: "https://quickswap.exchange/#/swap",
  dexscreenerTokenBase: "https://dexscreener.com/polygon",
  // Optional liquidity lock link (Unicrypt / PinkSale / TeamFinance / etc.)
  liquidityLockUrl: process.env.NEXT_PUBLIC_LIQ_LOCK_URL || "",
  liquidityLockLabel: process.env.NEXT_PUBLIC_LIQ_LOCK_LABEL || "Liquidity Lock",
};

export const ANALYTICS = {
  gaId: process.env.NEXT_PUBLIC_GA_ID || "",
};

export const EMBEDDED_WALLET = {
  // If set, site will show Privy login button + wallet info.
  privyAppId: process.env.NEXT_PUBLIC_PRIVY_APP_ID || "",
  // Optional alternative
  web3authClientId: process.env.NEXT_PUBLIC_WEB3AUTH_CLIENT_ID || "",
};
