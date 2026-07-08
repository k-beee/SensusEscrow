import { createClient, createAccount } from "genlayer-js";

// Permanent StudioNet configurations
export const CONTRACT = "0xA25F2C4Aa2977C93E5c05F5F7641A7AA1856fF59";
export const CHAIN_ID = 61999;
export const RPC = "https://studio.genlayer.com/api";
export const EXPLORER = "https://genlayer-explorer.vercel.app";

// StudioNet chain configuration mapping
const studioNet = {
  id: 61999,
  name: "Genlayer Studio Network",
  rpcUrls: {
    default: {
      http: ["https://studio.genlayer.com/api"]
    }
  }
};

export type Agreement = {
  agreement_id: number;
  client: string;
  provider: string;
  covenant_text: string;
  amount: string; // in wei
  status: string; // ACTIVE | CLAIMED | RESOLVED | REFUNDED
  evidence_url: string;
  verdict: string; // PENDING | PASS | FAIL | UNDETERMINED
  rationale: string;
  crank_count: number;
};

// Read-only client - direct wallet-free queries
const reader = createClient({ chain: studioNet as any, account: createAccount() });
const read = (functionName: string, args: any[] = []) =>
  reader.readContract({ address: CONTRACT, functionName, args });

export const agreementCount = async (): Promise<number> => Number(await read("agreement_count"));
export const getAgreement = (id: number) => read("get_agreement", [id]) as Promise<Agreement>;

// Internal helper with exponential backoff / retry mechanism to handle transient RPC timeouts
async function readAgreement(id: number, tries = 3): Promise<Agreement | null> {
  for (let t = 0; t < tries; t++) {
    try { return (await getAgreement(id)) as Agreement; } catch { await new Promise((r) => setTimeout(r, 400)); }
  }
  return null;
}

// Queries all agreements on-chain sequentially and returns them in reverse-chronological order
export async function listAgreements(): Promise<Agreement[]> {
  try {
    const n = await agreementCount();
    const out: Agreement[] = [];
    for (let i = 1; i <= n; i++) {
      const a = await readAgreement(i);
      if (a) out.push(a);
    }
    return out.reverse();
  } catch (e) {
    console.error("Error listing agreements:", e);
    return [];
  }
}

// Writes using the Privy provider
import { createClient as _cc } from "genlayer-js";
import { testnetBradbury as _chain } from "genlayer-js/chains";

export async function writeWith(provider: any, account: string, functionName: string, args: any[], value: string = "0"): Promise<string> {
  const client = _cc({ chain: _chain, account: account as any, provider } as any);
  const hash = await client.writeContract({ 
    address: CONTRACT, 
    functionName, 
    args,
    value: value !== "0" ? BigInt(value) : undefined 
  });
  
  // Wait generously for confirmation, but don't fail if wait times out
  try {
    await client.waitForTransactionReceipt({ hash, status: "ACCEPTED", interval: 5000, retries: 60 });
  } catch { /* transaction is still indexing/confirming on-chain */ }
  return hash as string;
}

// Store client-side transaction hashes since they aren't stored in contract storage
const TX_KEY = "sensusescrow.tx";
export function recordTx(id: number, hash: string) {
  try {
    const m = JSON.parse(localStorage.getItem(TX_KEY) || "{}");
    m[id] = hash;
    localStorage.setItem(TX_KEY, JSON.stringify(m));
  } catch {}
}
export function txOf(id: number): string | null {
  try {
    const m = JSON.parse(localStorage.getItem(TX_KEY) || "{}");
    if (m[id]) return m[id];
  } catch {}
  return null;
}
export const txUrl = (hash: string) => `${EXPLORER}/tx/${hash}`;
export const formatWei = (wei: string | number): string => {
  const val = Number(wei) / 1e18;
  return val.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 6 }) + " GEN";
};
