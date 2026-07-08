"""Seed mock agreements on SensusEscrow (StudioNet).

  python deploy/seed.py create <addr> <provider> <covenant> <amount_wei>
  python deploy/seed.py claim <addr> <id> <evidence_url>
  python deploy/seed.py crank <addr> <id>
  python deploy/seed.py refund <addr> <id>
  python deploy/seed.py list <addr>
"""
import os
import sys
import time
from pathlib import Path
import eth_utils
from dotenv import load_dotenv
from genlayer_py import create_account, create_client
from genlayer_py.abi import calldata
from genlayer_py.abi.transactions import serialize
from genlayer_py.chains import studionet
from genlayer_py.contracts.utils import make_calldata_object

load_dotenv()
ACCT = create_account(os.environ["ACCOUNT_PRIVATE_KEY"])
C = create_client(chain=studionet, account=ACCT)


def read(addr, fn, args=None):
    data = [calldata.encode(make_calldata_object(method=fn, args=args or [], kwargs=None)), b"\x00"]
    req = {
        "type": "read",
        "to": addr,
        "from": ACCT.address,
        "data": serialize(data),
    }
    r = C.provider.make_request(method="gen_call", params=[req])["result"]
    if isinstance(r, dict):
        if r.get("status", {}).get("code") != 0:
            return {"_err": r.get("status"), "stderr": r.get("stderr")}
        return calldata.decode(eth_utils.hexadecimal.decode_hex("0x" + r["data"]))
    return calldata.decode(eth_utils.hexadecimal.decode_hex("0x" + r))


def wait(txh):
    print(f"  {txh[:12]}.. Proposing")
    while True:
        try:
            tx = C.get_transaction(txh)
            status = tx.get("status")
            code = int(status) if status is not None else 0
            if code in (5, 7):
                return
        except Exception:
            pass
        time.sleep(2)


def write(addr, fn, args, value=0):
    txh = C.write_contract(address=addr, function_name=fn, account=ACCT, args=args, value=value)
    txh = txh if isinstance(txh, str) else eth_utils.hexadecimal.encode_hex(txh)
    print(" tx:", txh)
    wait(txh)
    return txh


cmd = sys.argv[1]
if cmd == "create":
    addr = sys.argv[2]
    provider = sys.argv[3]
    cov = sys.argv[4]
    amount = int(sys.argv[5])
    print(f"Creating agreement with provider {provider} for {amount} wei...")
    write(addr, "create_agreement", [provider, cov], value=amount)
    print("total agreements =", read(addr, "agreement_count"))

elif cmd == "claim":
    addr = sys.argv[2]
    aid = int(sys.argv[3])
    url = sys.argv[4]
    print(f"Submitting claim for agreement {aid} with URL {url}...")
    write(addr, "submit_claim", [aid, url])
    print("agreement state =", read(addr, "get_agreement", [aid]))

elif cmd == "crank":
    addr = sys.argv[2]
    aid = int(sys.argv[3])
    print(f"Cranking agreement {aid} (consensus run)...")
    write(addr, "crank", [aid])
    print("agreement state =", read(addr, "get_agreement", [aid]))

elif cmd == "refund":
    addr = sys.argv[2]
    aid = int(sys.argv[3])
    print(f"Requesting voluntary refund on agreement {aid}...")
    write(addr, "voluntary_refund", [aid])
    print("agreement state =", read(addr, "get_agreement", [aid]))

elif cmd == "list":
    addr = sys.argv[2]
    n = int(read(addr, "agreement_count"))
    print(f"Total agreements: {n}")
    for i in range(1, n + 1):
        a = read(addr, "get_agreement", [i])
        print(f"#{i} [{a['status']}] {a['verdict']} amount={a['amount']} client={a['client'][:6]}.. provider={a['provider'][:6]} :: {a['covenant_text'][:50]}")
