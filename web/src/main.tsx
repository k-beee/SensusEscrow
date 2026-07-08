import React from "react";
import { createRoot } from "react-dom/client";
import { PrivyProvider } from "@privy-io/react-auth";
import App from "./App";
import "./styles.css";

const bradbury = {
  id: 4221,
  name: "GenLayer Bradbury",
  nativeCurrency: { name: "GEN", symbol: "GEN", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc-bradbury.genlayer.com"] } },
  blockExplorers: { default: { name: "Explorer", url: "https://explorer-bradbury.genlayer.com" } },
} as const;

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <PrivyProvider
      appId="cmpyp3g71004t0cl7chm5q31u"
      config={{
        defaultChain: bradbury as any,
        supportedChains: [bradbury as any],
        appearance: { theme: "dark", accentColor: "#3e77b6" },
        embeddedWallets: { createOnLogin: "users-without-wallets" },
      }}
    >
      <App />
    </PrivyProvider>
  </React.StrictMode>,
);
