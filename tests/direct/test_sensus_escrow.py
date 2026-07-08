"""Direct-mode unit tests for SensusEscrow intelligent contract.

We verify client deposits, provider claims, consensus validations,
automatic payouts, refunds, and permission checks.
"""
import json

CONTRACT = "contracts/sensus_escrow.py"
WEB = r".*evidence-source\.org.*"
LLM = r".*expert consensus adjudicator.*"
URL = "https://evidence-source.org/verify"


def _mock(direct_vm, verdict):
    direct_vm.clear_mocks()
    direct_vm.mock_web(WEB, {"status": 200, "body": "Evidence: deliverable met all latency parameters."})
    direct_vm.mock_llm(LLM, json.dumps({"verdict": verdict, "rationale": "validation succeeded"}))


def test_escrow_lifecycle_pass(direct_vm, direct_deploy, direct_owner, direct_bob):
    # Setup roles: owner is client, bob is provider
    client = direct_owner
    provider = direct_bob

    # Deploy contract
    direct_vm.sender = client
    c = direct_deploy(CONTRACT)

    # 1. Create Agreement (escrow deposit)
    direct_vm.value = 1000000000000000000  # 1 native token
    aid = int(c.create_agreement(provider, "Deliverable latency is below 200ms"))
    assert aid == 1
    assert c.agreement_count() == 1

    a = c.get_agreement(aid)
    assert a["client"] == client.hex()
    assert a["provider"] == provider.hex()
    assert a["amount"] == 1000000000000000000
    assert a["status"] == "ACTIVE"
    assert a["verdict"] == "PENDING"

    # 2. Submit Claim (only provider)
    direct_vm.value = 0
    with direct_vm.expect_revert("only provider can submit a claim"):
        c.submit_claim(aid, URL)

    direct_vm.sender = provider
    res_claim = c.submit_claim(aid, URL)
    assert res_claim["status"] == "CLAIMED"
    assert res_claim["evidence_url"] == URL

    # 3. Crank with PASS verdict (releases funds to provider)
    _mock(direct_vm, "PASS")
    # Scribe/anyone can crank
    direct_vm.sender = client
    res_crank = c.crank(aid)
    assert res_crank["status"] == "RESOLVED"
    assert res_crank["verdict"] == "PASS"
    assert res_crank["crank_count"] == 1


def test_escrow_lifecycle_fail(direct_vm, direct_deploy, direct_owner, direct_bob):
    client = direct_owner
    provider = direct_bob

    direct_vm.sender = client
    c = direct_deploy(CONTRACT)

    direct_vm.value = 500000
    aid = int(c.create_agreement(provider, "Deliverable works on iOS"))

    # Submit claim
    direct_vm.value = 0
    direct_vm.sender = provider
    c.submit_claim(aid, URL)

    # Crank with FAIL verdict (refunds client)
    _mock(direct_vm, "FAIL")
    res_crank = c.crank(aid)
    assert res_crank["status"] == "REFUNDED"
    assert res_crank["verdict"] == "FAIL"


def test_voluntary_refund(direct_vm, direct_deploy, direct_owner, direct_bob):
    client = direct_owner
    provider = direct_bob

    direct_vm.sender = client
    c = direct_deploy(CONTRACT)

    direct_vm.value = 800000
    aid = int(c.create_agreement(provider, "Cancelable agreement"))

    # Provider performs voluntary refund
    direct_vm.value = 0
    direct_vm.sender = provider
    res = c.voluntary_refund(aid)
    assert res["status"] == "REFUNDED"
    assert res["rationale"] == "Voluntary provider refund"


def test_undetermined_reset(direct_vm, direct_deploy, direct_owner, direct_bob):
    client = direct_owner
    provider = direct_bob

    direct_vm.sender = client
    c = direct_deploy(CONTRACT)

    direct_vm.value = 300000
    aid = int(c.create_agreement(provider, "Check updates"))

    direct_vm.sender = provider
    c.submit_claim(aid, URL)

    # Crank with UNDETERMINED (resets to ACTIVE for further evidence)
    _mock(direct_vm, "UNDETERMINED")
    direct_vm.sender = client
    res = c.crank(aid)
    assert res["status"] == "ACTIVE"
    assert res["verdict"] == "UNDETERMINED"
