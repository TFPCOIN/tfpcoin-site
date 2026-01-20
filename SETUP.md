# TFPCOIN Next.js Site

## Environment variables (Vercel)

You can deploy without any env vars, but these unlock the "wallet/app" features.

### Token
- `NEXT_PUBLIC_TOKEN_ADDRESS` (default is already set)
- `NEXT_PUBLIC_TOKEN_SYMBOL` (default TFPC)
- `NEXT_PUBLIC_TOKEN_DECIMALS` (default 18)

### Embedded wallet (optional)
Privy (recommended):
- `NEXT_PUBLIC_PRIVY_APP_ID`

Web3Auth (optional):
- `NEXT_PUBLIC_WEB3AUTH_CLIENT_ID`

### Analytics (optional)
Google Analytics 4:
- `NEXT_PUBLIC_GA_ID` (looks like `G-XXXXXXXXXX`)

### Liquidity lock badge (optional)
- `NEXT_PUBLIC_LIQ_LOCK_URL` (link to the lock proof)
- `NEXT_PUBLIC_LIQ_LOCK_LABEL` (badge text)

Note: Only show a liquidity lock badge if you can link to proof.
