# SensusEscrow — Decentralized Semantic Escrow Agreement Protocol

SensusEscrow is a decentralized native escrow agreement protocol on GenLayer. It enables parties to lock funds on-chain under **plain-language covenants** (e.g., *"the delivered code passes latency tests under 150ms"* or *"the published text matches the editorial guidelines"*). When a service provider claims fulfillment, GenLayer validators fetch the cited proof, run LLM consensus on whether the conditions are satisfied, and automatically route the locked collateral: releasing 100% of the funds to the provider on `PASS`, or refunding the client on `FAIL`.

It is actively designed to work natively on **Testnet Bradbury (chain 4221)**.

---

## Why GenLayer is Essential for Semantic Escrows

Standard smart contract platforms (like Ethereum or Solana) are fundamentally limited to deterministic bytecode. They cannot evaluate natural-language conditions because:
1. **No byte-level representation:** A covenant such as *"reasonable latency"* or *"high-quality documentation"* has no canonical binary state.
2. **Oracle centralisation:** Deterministic blockchains must rely on a trusted off-chain party (an oracle or multi-sig committee) to fetch web pages, run LLMs, and write the verdict back to the chain.

GenLayer resolves this by pushing non-deterministic evaluations into the consensus engine itself. SensusEscrow leverages GenLayer's primary strengths:
- **Non-deterministic rendering:** Validators fetch and parse dynamic web contents via `gl.nondet.web.render(url)`.
- **Decentralized LLM inference:** Validators evaluate the evidence using heterogeneous LLMs via `gl.nondet.exec_prompt(...)`.
- **Categorical consensus:** Instead of comparing raw model string completions (which vary naturally), validators run the same code and reach consensus on a categorical verdict enum (`PASS`/`FAIL`/`UNDETERMINED`) inside `gl.vm.run_nondet_unsafe(...)`.

---

## The Protocol Lifecycle

```
    [Create Escrow] (Client locks native value in ACTIVE state)
           │
           ▼
     [Submit Claim] (Provider uploads completion evidence URL; status -> CLAIMED)
           │
           ▼
       [Crank AI] (Validators fetch proof + execute consensus prompts)
           │
           ├─── PASS ──────▶ [RESOLVED] ──▶ Auto-release locked funds to Provider
           │
           ├─── FAIL ──────▶ [REFUNDED] ──▶ Auto-refund locked funds to Client
           │
           └─── UNDETERMINED ─▶ [ACTIVE] ──▶ Returns to active state for better proof
```

*Note: SensusEscrow also supports a **Voluntary Refund** path where the provider can voluntarily cancel the agreement and refund the client, bypassing validation.*

---

## Technical Specifications & Security

- **Strict Custom Equivalence:** Consensus is enforced only on the verdict categories. This ensures minor linguistic variations in LLM rationales do not trigger consensus deadlocks.
- **Payload & Input Sanitization:** Control characters are stripped and string inputs are strictly length-capped before building prompt scopes, preventing prompt injection attacks.
- **Consensus Size Protection:** Evidence text is capped at 6,000 characters to keep network data overhead small and transaction times fast.
- **No Float Usage:** The contract strictly avoids Python floats (which are non-deterministic at runtime) and handles balances using integer values in Wei equivalents.
- **Idempotent Adjudication:** If a contract has already resolved, calling `crank` returns current state immediately without running additional validation rounds.

---

## Code Repository Structure

```
SensusEscrow/
├── contracts/
│   └── sensus_escrow.py      # Py-GenVM Intelligent Contract
├── tests/
│   └── direct/
│       └── test_sensus_escrow.py # Mocked in-memory pytest suite
├── deploy/
│   ├── deploy.py             # Bradbury deployment script
│   └── seed.py               # Interactive CLI seeding tool
├── web/
│   ├── src/
│   │   ├── lib/
│   │   │   └── contract.ts   # Contract client integration (genlayer-js)
│   │   ├── App.tsx           # Classy Sapphire Dashboard UI
│   │   ├── main.tsx          # App entry and Privy wrapper
│   │   └── styles.css        # Customs styling and animations
│   ├── tailwind.config.js    # Tailwind styling config
│   ├── vite.config.ts        # Vite bundle builder
│   └── package.json          # Node dependencies list
├── gltest.config.yaml        # Local test runner config
└── README.md                 # Project documentation
```

---

## Build, Test, and Deploy

### Prerequisites
- Python ≥ 3.12
- Node.js ≥ 18
- Access to the Bradbury faucet to fund your deployment address: [Bradbury Faucet](https://testnet-faucet.genlayer.foundation/)

### 1. Smart Contract Development

```bash
# Set up virtual environment & install requirements
python3 -m venv .venv
source .venv/bin/activate
pip install -r ../LexForge/requirements.txt  # Installs genvm-linter and testing suites

# Lint the contract (AST safety check)
genvm-lint check contracts/sensus_escrow.py

# Run direct-mode unit tests
ACCOUNT_PRIVATE_KEY=0x<your-32-byte-hex> pytest tests/direct/ -q
```

### 2. Contract Deployment

Create a `.env` file in the root directory:
```env
ACCOUNT_PRIVATE_KEY=0x<your-private-key-hex-here>
```

Deploy the contract:
```bash
python deploy/deploy.py
```

### 3. Running the Frontend

Once the contract is deployed, update the `CONTRACT` address inside `web/src/lib/contract.ts` with your new contract address:
```typescript
export const CONTRACT = "0x<your-deployed-contract-address>";
```

Install packages and build the static assets:
```bash
cd web
npm install
npm run build
```

To run the local development server:
```bash
npm run dev
```

---

## Product Roadmap

- **Escrow Fee Pools:** Implement a scribe fee pool where callers of the `crank` transaction are rewarded with a small fraction of the escrow to incentivize decentralized upkeep.
- **Multisig Dispute Initiation:** Enable multi-sig claims where multiple providers or clients must sign off to initiate or contest validation.
- **Evidence Screen-capture Parsing:** Support visual evidence parsing where validators use multimodal Vision models to check graphical proof.
