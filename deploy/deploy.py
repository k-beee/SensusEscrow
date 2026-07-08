"""Deploy SensusEscrow to GenLayer StudioNet (chain 61999).

Reads ACCOUNT_PRIVATE_KEY from .env.
"""
import os
from pathlib import Path
from dotenv import load_dotenv
from genlayer_py import create_account, create_client
from genlayer_py.chains import studionet
from genlayer_py.types.transactions import TransactionStatus

load_dotenv()

# Read private key from the git-ignored local environment file
key = os.environ.get("ACCOUNT_PRIVATE_KEY", "")
if not key or set(key.replace("0x", "")) <= {"0"}:
    raise SystemExit("ACCOUNT_PRIVATE_KEY missing in .env. Setup .env with private key.")

# Setup account object and initialize client for the StudioNet chain
account = create_account(key)
client = create_client(chain=studionet, account=account)
code = Path("contracts/sensus_escrow.py").read_text()

print(f"Deploying SensusEscrow to {studionet.name} as {account.address}")
tx_hash = client.deploy_contract(code=code, account=account)
print("deploy tx hash:", tx_hash)

receipt = client.wait_for_transaction_receipt(
    transaction_hash=tx_hash, status=TransactionStatus.FINALIZED, interval=5000, retries=60
)
status = getattr(receipt, "status", receipt)
address = getattr(receipt, "contract_address", None) or getattr(
    getattr(receipt, "data", None), "contract_address", None
)
print("status:", status)
print("contract address:", address)
print(f"explorer link: https://explorer-bradbury.genlayer.com/contracts/{address}")
