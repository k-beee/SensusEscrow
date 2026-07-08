import React from "react";
import { createRoot } from "react-dom/client";
import { PrivyProvider } from "@privy-io/react-auth";
import App from "./App";
import "./styles.css";

const studioNet = {
  id: 61999,
  name: "Genlayer Studio Network",
  nativeCurrency: { name: "GEN", symbol: "GEN", decimals: 18 },
  rpcUrls: { default: { http: ["https://studio.genlayer.com/api"] } },
  blockExplorers: { default: { name: "Explorer", url: "https://genlayer-explorer.vercel.app" } },
} as const;

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <PrivyProvider
      appId="cmpyp3g71004t0cl7chm5q31u"
      config={{
        defaultChain: studioNet as any,
        supportedChains: [studioNet as any],
        appearance: { theme: "dark", accentColor: "#3e77b6" },
        embeddedWallets: { createOnLogin: "users-without-wallets" },
      }}
    >
      <App />
    </PrivyProvider>
  </React.StrictMode>,
);
