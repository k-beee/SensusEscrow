# SensusEscrow: Decentralized Semantic Escrow Protocol

A decentralized, trustless escrow agreement coordinator running natively on GenLayer. SensusEscrow allows adversarial parties to deposit native tokens (GEN) into a smart escrow contract and settle outcomes based on **natural-language covenants** rather than rigid bytecode.

GenLayer validators evaluate dynamic web evidence, reach consensus on fulfillment using LLMs, and route locked escrow balances automatically:
- **PASS:** 100% of escrowed funds are released to the provider.
- **FAIL:** 100% of escrowed funds are refunded to the client.
- **UNDETERMINED:** Funds remain locked, resetting status to active for updated evidence.

---

## The Semantic Escrow Problem: EVM vs. GenLayer

| Feature / Scenario | Traditional EVM Escrow | GenLayer SensusEscrow |
| :--- | :--- | :--- |
| **Agreement Terms** | Must be coded in strict Solidity variables (e.g. integer bounds, timestamps). | Written in natural language (e.g., *"API response latency remains under 150ms"*). |
| **Evidence Validation** | Relies on centralized off-chain oracle feeds or trusted multi-sig admin keys. | Decentralized consensus of validators fetching and parsing web sources natively. |
| **LLM Reasoning** | Impossible on-chain; must run off-chain via centralized servers. | Native, deterministic LLM evaluation executing inside the consensus boundary. |
| **Trust Model** | Trust the single operator/oracle not to manipulate inputs. | Trust the categorical consensus of the validator network. |

---

## Execution Protocol Flow

1. **Escrow Deployment:** The client initializes an agreement with `create_agreement(provider_address, covenant_text)` and deposits native funds. The agreement status enters `ACTIVE`.
2. **Delivery Claim:** Once service is complete, the provider calls `submit_claim(agreement_id, evidence_url)`. This moves status to `CLAIMED` and logs the evidence page URL.
3. **Consensus Arbitration:** A keeper/scribe calls `crank(agreement_id)`. Validators dynamically fetch evidence via `gl.nondet.web.render`, prompt LLMs to evaluate against covenant terms, and execute custom validation to agree on the categorical verdict.
4. **Auto-Settlement:** State mutates deterministically based on the consensus verdict. PASS transfers funds to the provider; FAIL refunds the client; UNDETERMINED resets the agreement back to `ACTIVE` so the provider can submit updated evidence.

*Note: SensusEscrow features a **Voluntary Refund** route where the provider can voluntarily refund the client, bypassing validation if they wish to cancel.*

---

## User Dashboard & Interactive CLI Console

SensusEscrow ships with a premium dashboard styled in a deep **Sapphire and Platinum** color palette.

### 1. Guided UI Panels
- **Create Escrow:** Form to specify provider address, draft plain-text covenants, and enter native value.
- **File Claim:** Portal for providers to submit active agreement IDs and completion evidence URLs.
- **Request Refund:** Voluntary cancel portal for service providers.

### 2. Built-in Terminal Shell Console
An interactive terminal console is built directly into the UI dashboard, allowing power users to query state and execute actions using slash commands:
- `/list` — Display all escrow agreements currently recorded on-chain.
- `/get <agreement_id>` — Retrieve full JSON state details of an agreement.
- `/crank <agreement_id>` — Trigger validator consensus run on a submitted claim.
- `/clear` — Clear terminal logs history.
- `/help` — List terminal operations.

---

## Developer Handbook

### File Directory Layout
```
SensusEscrow/
├── contracts/
│   └── sensus_escrow.py      # Core intelligent contract
├── tests/
│   └── direct/
│       └── test_sensus_escrow.py # direct-mode pytest suite
├── deploy/
│   ├── deploy.py             # Contract deployment script
│   └── seed.py               # Interactive CLI testing helper
├── web/
│   ├── src/
│   │   ├── lib/
│   │   │   └── contract.ts   # RPC provider (genlayer-js)
│   │   ├── App.tsx           # React Dashboard UI
│   │   ├── main.tsx          # React entry with Privy
│   │   └── styles.css        # Sapphire theme custom CSS
│   ├── package.json          # Node package list
│   └── tailwind.config.js    # Tailwind layout options
└── gltest.config.yaml        # test runner config
```

### Setup & Local Testing

SensusEscrow requires **Python ≥ 3.12** and **Node.js ≥ 18**.

```bash
# 1. Initialize environment & install requirements
python3 -m venv .venv
source .venv/bin/activate
pip install -r ../LexForge/requirements.txt

# 2. Check contract validity and safety rules
genvm-lint check contracts/sensus_escrow.py

# 3. Run mock direct-mode pytest suite
ACCOUNT_PRIVATE_KEY=0x<your-32-byte-private-key> pytest tests/direct/ -q
```

### On-Chain Deployment

Configure your private key in a local git-ignored `.env` file in the root:
```env
ACCOUNT_PRIVATE_KEY=0x<your-private-key-hex-prefixed-with-0x>
```

Run the deploy script:
```bash
python deploy/deploy.py
```
This will compile the contract code, send the deploy transaction, and print the active contract address. Update the `CONTRACT` constant in `web/src/lib/contract.ts` with the new address before running the web server:
```bash
cd web
npm install
npm run dev
```

---

## Evolution Roadmap

- **Scribe Reward Pools:** Implement a transaction bounty system where a small percentage of the escrow is automatically awarded to the keeper/scribe who successfully triggers the `crank` transaction, incentivizing continuous operation.
- **Multisig Covenants:** Enable client and provider accounts to be multi-sig inputs, allowing complex corporate or team agreements.
- **Arbitration Quorums & Appeals:** Build an appeal pathway where contested verdicts escalate to higher consensus models with visual screen-capture evidence.
