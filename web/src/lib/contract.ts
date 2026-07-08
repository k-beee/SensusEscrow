import { createClient, createAccount } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";

// PLACEHOLDER: Update this with the deployed contract address
export const CONTRACT = "0x0000000000000000000000000000000000000000";
export const CHAIN_ID = 4221;
export const RPC = "https://rpc-bradbury.genlayer.com";
export const EXPLORER = "https://explorer-bradbury.genlayer.com";

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
const reader = createClient({ chain: testnetBradbury, account: createAccount() });
const read = (functionName: string, args: any[] = []) =>
  reader.readContract({ address: CONTRACT, functionName, args });

export const agreementCount = async (): Promise<number> => Number(await read("agreement_count"));
export const getAgreement = (id: number) => read("get_agreement", [id]) as Promise<Agreement>;

async function readAgreement(id: number, tries = 3): Promise<Agreement | null> {
  for (let t = 0; t < tries; t++) {
    try { return (await getAgreement(id)) as Agreement; } catch { await new Promise((r) => setTimeout(r, 400)); }
  }
  return null;
}

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
