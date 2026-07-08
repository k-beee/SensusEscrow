import { useEffect, useRef, useState } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { 
  CONTRACT, 
  EXPLORER, 
  CHAIN_ID, 
  type Agreement, 
  listAgreements, 
  writeWith, 
  getAgreement, 
  agreementCount, 
  txOf, 
  recordTx, 
  txUrl, 
  formatWei 
} from "./lib/contract";

const short = (a: string) => (a ? a.slice(0, 6) + "…" + a.slice(-4) : "");

const spot = (e: React.MouseEvent<HTMLElement>) => {
  const r = e.currentTarget.getBoundingClientRect();
  e.currentTarget.style.setProperty("--mouse-x", `${e.clientX - r.left}px`);
  e.currentTarget.style.setProperty("--mouse-y", `${e.clientY - r.top}px`);
};

function Logo({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
      <circle cx="16" cy="16" r="14" stroke="currentColor" strokeWidth="2" />
      <path d="M16 8v16M11 13h10M12 19h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function useReveal() {
  useEffect(() => {
    const io = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && (e.target.classList.add("revealed"), io.unobserve(e.target))), { threshold: 0.1 });
    document.querySelectorAll(".reveal-fade-in").forEach((el) => io.observe(el));
    return () => io.disconnect();
  });
}

function NodeCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current!, ctx = c.getContext("2d")!;
    let raf = 0;
    let dots: any[] = [];
    const size = () => {
      const r = c.parentElement!.getBoundingClientRect();
      c.width = r.width;
      c.height = r.height;
      dots = Array.from({ length: 24 }, () => ({
        x: Math.random() * c.width,
        y: Math.random() * c.height,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        r: Math.random() * 2 + 1,
      }));
    };
    const draw = () => {
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.fillStyle = "#5392ca";
      dots.forEach((d) => {
        d.x += d.vx;
        d.y += d.vy;
        if (d.x < 0 || d.x > c.width) d.vx *= -1;
        if (d.y < 0 || d.y > c.height) d.vy *= -1;
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fill();
      });
      for (let i = 0; i < dots.length; i++) {
        for (let j = i + 1; j < dots.length; j++) {
          const a = dots[i], b = dots[j], dist = Math.hypot(a.x - b.x, a.y - b.y);
          if (dist < 100) {
            ctx.strokeStyle = `rgba(83,146,202,${1 - dist / 100})`;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }
      raf = requestAnimationFrame(draw);
    };
    size();
    draw();
    const onR = () => { cancelAnimationFrame(raf); size(); draw(); };
    window.addEventListener("resize", onR);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", onR); };
  }, []);
  return <canvas ref={ref} className="w-full h-full" />;
}

export default function App() {
  // Core state for active agreements queried from the GenLayer blockchain
  const [agreements, setAgreements] = useState<Agreement[]>([]);
  
  // Privy authentication states for secure write calls
  const { ready, authenticated, login, logout } = usePrivy();
  const { wallets } = useWallets();
  const wallet = wallets[0];
  const acct = wallet?.address || "";
  
  // UX UI Layout states
  const [scrolled, setScrolled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toasts, setToasts] = useState<{ id: number; m: string }[]>([]);
  const [activeTab, setActiveTab] = useState<"create" | "claim" | "refund">("create");
  
  // Interactive console terminal lines log
  const [consoleLines, setConsoleLines] = useState<{ k: string; t: string }[]>([
    { k: "system", t: "SensusEscrow Protocol Console [Online]" },
    { k: "dim", t: "Bound to GenLayer Bradbury testnet · Chain ID: " + CHAIN_ID },
    { k: "norm", t: "Type /help to query available commands, or /list to load agreements." },
  ]);
  const [consoleInput, setConsoleInput] = useState("");
  
  // Guided transaction input forms states
  const [createForm, setCreateForm] = useState({ provider: "", covenant: "", amount: "" });
  const [claimForm, setClaimForm] = useState({ agreement_id: "", evidence_url: "" });
  const [refundForm, setRefundForm] = useState({ agreement_id: "" });
  
  const consoleScreenRef = useRef<HTMLDivElement>(null);

  useReveal();

  const refresh = () => listAgreements().then(setAgreements).catch((e) => toast(String(e?.message || e)));
  const toast = (m: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, m }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  };
  const printConsole = (t: string, k = "norm") => setConsoleLines((l) => [...l, { k, t }]);

  useEffect(() => {
    refresh();
    const handleScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    consoleScreenRef.current?.scrollTo(0, consoleScreenRef.current.scrollHeight);
  }, [consoleLines]);

  const onConnect = async () => {
    try {
      if (!ready) return;
      authenticated ? await logout() : await login();
    } catch (e: any) {
      toast(e.message);
    }
  };

  async function runConsoleCommand(raw: string) {
    const v = raw.trim();
    if (!v) return;
    printConsole(v, "cmd");
    setConsoleInput("");
    const [cmd, ...rest] = v.split(/\s+/);
    const arg = rest.join(" ");
    
    try {
      if (cmd === "/help") {
        printConsole("Available operations:", "system");
        printConsole("/list — Display all agreements on-chain", "system");
        printConsole("/get <id> — Inspect detailed agreement state", "system");
        printConsole("/crank <id> — Trigger semantic adjudication run", "system");
        printConsole("/clear — Clear console output history", "system");
      } else if (cmd === "/clear") {
        setConsoleLines([]);
      } else if (cmd === "/list") {
        const list = await listAgreements();
        setAgreements(list);
        if (!list.length) printConsole("No agreements recorded on-chain.", "dim");
        list.forEach((a) => {
          printConsole(`#${a.agreement_id} [${a.status}] verdict: ${a.verdict} - amount: ${formatWei(a.amount)}`, a.verdict === "PASS" ? "ok" : "norm");
        });
      } else if (cmd === "/get") {
        if (!arg) return printConsole("Usage: /get <agreement_id>", "err");
        const a = await getAgreement(Number(arg));
        printConsole(JSON.stringify(a, null, 2));
      } else if (cmd === "/crank") {
        if (!arg) return printConsole("Usage: /crank <agreement_id>", "err");
        await executeTx("crank", [Number(arg)]);
      } else {
        printConsole(`Unknown command "${cmd}". Try /help for assistance.`, "err");
      }
    } catch (e: any) {
      printConsole(e?.message || String(e), "err");
    }
  }

  async function executeTx(fn: string, args: any[], value: string = "0") {
    if (!wallet) {
      toast("Authentication required. Please connect your wallet.");
      try { await login(); } catch {}
      return;
    }
    setBusy(true);
    printConsole(`Submitting ${fn}... Web3 validation rounds take 1-3 minutes.`, "dim");
    try {
      await wallet.switchChain(CHAIN_ID);
      const provider = await wallet.getEthereumProvider();
      const h = await writeWith(provider, wallet.address, fn, args, value);
      const aid = typeof args[0] === "number" ? args[0] : await agreementCount();
      recordTx(aid, h);
      printConsole(`Receipt confirmed. Transaction: ${h.slice(0, 16)}...`, "ok");
      toast(`Transaction ${fn} successful.`);
      await refresh();
    } catch (e: any) {
      printConsole(e?.shortMessage || e?.message || String(e), "err");
      toast("Transaction failed - see console log.");
    } finally {
      setBusy(false);
    }
  }

  const handleCreate = async () => {
    if (!createForm.provider || !createForm.covenant || !createForm.amount) {
      return toast("Please fill in all agreement parameters.");
    }
    // Convert amount in GEN to Wei
    const weiVal = (Number(createForm.amount) * 1e18).toString();
    await executeTx("create_agreement", [createForm.provider, createForm.covenant], weiVal);
    setCreateForm({ provider: "", covenant: "", amount: "" });
  };

  const handleClaim = async () => {
    if (!claimForm.agreement_id || !claimForm.evidence_url) {
      return toast("Please provide the agreement ID and evidence URL.");
    }
    await executeTx("submit_claim", [Number(claimForm.agreement_id), claimForm.evidence_url]);
    setClaimForm({ agreement_id: "", evidence_url: "" });
  };

  const handleRefund = async () => {
    if (!refundForm.agreement_id) {
      return toast("Please specify the agreement ID.");
    }
    await executeTx("voluntary_refund", [Number(refundForm.agreement_id)]);
    setRefundForm({ agreement_id: "" });
  };

  const totalEscrowed = agreements.reduce((acc, a) => acc + (a.status !== "REFUNDED" && a.status !== "RESOLVED" ? Number(a.amount) : 0), 0);
  const resolvedCount = agreements.filter((a) => a.status === "RESOLVED").length;
  const refundedCount = agreements.filter((a) => a.status === "REFUNDED").length;

  return (
    <>
      {/* Background Gradients */}
      <div className="fixed top-[10%] left-[-15%] w-[500px] h-[500px] sapphire-glow bg-sapphire-700/10 blur-[120px] pointer-events-none z-0 rounded-full" />
      <div className="fixed bottom-[15%] right-[-15%] w-[550px] h-[550px] sapphire-glow bg-sapphire-500/5 blur-[140px] pointer-events-none z-0 rounded-full" style={{ animationDelay: "-8s" }} />

      {/* Nav */}
      <header className={`fixed top-0 left-0 w-full z-50 transition-all duration-500 border-b transition-premium ${scrolled ? "bg-platinum-950/90 backdrop-blur-md border-white/5" : "border-transparent"}`}>
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <a href="#hero" className="flex items-center space-x-3 group">
            <div className="w-9 h-9 rounded-xl bg-white text-sapphire-900 grid place-items-center transition-transform duration-700 transition-premium group-hover:rotate-[180deg]">
              <Logo className="w-5 h-5" />
            </div>
            <span className="font-serif text-sm font-semibold tracking-[0.15em] text-white">SensusEscrow</span>
          </a>
          <nav className="hidden md:flex items-center space-x-8 text-[11px] font-mono uppercase tracking-[0.2em] text-white/50">
            <a href="#workspace" className="hover:text-white sapphire-underline py-1">Workspace</a>
            <a href="#docket" className="hover:text-white sapphire-underline py-1">Docket</a>
            <a href={EXPLORER} target="_blank" rel="noopener noreferrer" className="hover:text-white sapphire-underline py-1">Bradbury Explorer</a>
          </nav>
          <div className="flex items-center space-x-4">
            {authenticated ? (
              <div className="flex items-center space-x-2">
                <span className="px-4 py-2 border border-white/5 rounded-full font-mono text-[10px] text-white/70 bg-white/[0.02]">{short(acct)}</span>
                <button onClick={() => logout()} className="px-4 py-2 border border-white/10 rounded-full font-mono text-[10px] text-white/50 hover:text-red-400 hover:border-red-400/40 transition-all">Disconnect</button>
              </div>
            ) : (
              <button onClick={onConnect} className="px-5 py-2.5 rounded-full font-mono text-[10px] uppercase tracking-wider bg-white text-sapphire-950 hover:bg-sapphire-300 transition-all duration-500">Connect Wallet</button>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section id="hero" className="relative min-h-[85vh] w-full flex items-center pt-32 pb-16 px-6 z-10">
        <div className="max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-7 flex flex-col space-y-8">
            <div className="inline-flex items-center space-x-2 bg-sapphire-500/10 border border-sapphire-500/25 px-4 py-1.5 rounded-full w-fit">
              <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sapphire-400 opacity-75" /><span className="relative inline-flex rounded-full h-2 w-2 bg-sapphire-400" /></span>
              <span className="font-mono text-[10px] uppercase tracking-widest text-sapphire-300">Decentralized AI Escrow Protocol</span>
            </div>
            <h1 className="font-serif text-5xl md:text-[5.5rem] leading-[1.0] font-light tracking-tight text-white max-w-2xl">
              Covenants that settle on <span className="italic text-sapphire-400 font-normal">semantic truth</span>.
            </h1>
            <p className="text-white/50 text-base leading-relaxed font-light max-w-xl">
              Lock native escrow funds under plain-language agreements. GenLayer’s validator set fetches evidence, executes consensus checks on natural-language conditions, and automatically triggers payouts.
            </p>
            <div className="flex flex-wrap items-center gap-4 pt-2">
              <a href="#workspace" className="px-8 py-3.5 bg-white text-sapphire-950 font-mono text-[10px] uppercase tracking-[0.2em] rounded-full hover:bg-sapphire-300 transition-all duration-500 hover:-translate-y-0.5">Enter Workspace</a>
              <a href="#docket" className="px-8 py-3.5 border border-white/10 hover:border-white/30 text-white/80 font-mono text-[10px] uppercase tracking-[0.2em] rounded-full transition-all duration-500 hover:-translate-y-0.5">View Active Docket</a>
            </div>
          </div>
          <div className="lg:col-span-5 relative w-full flex justify-end">
            <div className="relative w-full min-h-[460px] glass-panel rounded-2xl p-6 flex flex-col justify-between overflow-hidden shadow-[0_15px_40px_rgba(0,0,0,0.5)]">
              <div className="flex items-center justify-between border-b border-white/5 pb-4">
                <span className="font-mono text-[10px] uppercase tracking-widest text-white/30">Network Telemetry</span>
                <span className="w-2 h-2 bg-sapphire-400 rounded-full animate-pulse" />
              </div>
              <div className="absolute inset-0 z-0 top-16 opacity-20"><NodeCanvas /></div>
              <div className="relative z-10 glass-panel p-4 rounded-xl bg-platinum-950/80 my-4 flex-1 overflow-y-auto max-h-[220px]">
                <div className="font-mono text-[9px] text-sapphire-300 mb-2 uppercase tracking-widest">On-Chain Activity Feed</div>
                {agreements.length === 0 ? (
                  <p className="font-mono text-[10px] text-white/30">Waiting for database sync...</p>
                ) : (
                  agreements.slice(0, 5).map((a) => (
                    <div key={a.agreement_id} className="flex justify-between border-t border-white/5 py-2 text-xs font-light">
                      <div className="truncate pr-4">
                        <span className="font-mono text-[9px] text-white/30 mr-2">#{a.agreement_id}</span>
                        {a.covenant_text}
                      </div>
                      <span className={`font-mono text-[10px] uppercase font-medium ${a.status === "RESOLVED" ? "text-sapphire-300" : a.status === "REFUNDED" ? "text-red-400" : "text-white/40"}`}>{a.status}</span>
                    </div>
                  ))
                )}
              </div>
              <div className="relative z-10 grid grid-cols-2 gap-4">
                <div className="glass-panel p-4 rounded-xl bg-platinum-950/40">
                  <span className="block font-mono text-[8px] uppercase tracking-wider text-white/40 mb-1">Total Escrow Pool</span>
                  <span className="text-lg font-mono font-medium text-white">{formatWei(totalEscrowed)}</span>
                </div>
                <div className="glass-panel p-4 rounded-xl bg-platinum-950/40">
                  <span className="block font-mono text-[8px] uppercase tracking-wider text-white/40 mb-1">Settled / Refunded</span>
                  <span className="text-lg font-mono font-medium text-sapphire-400">{resolvedCount} <span className="text-white/35">/</span> {refundedCount}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Workspace */}
      <section id="workspace" className="relative py-24 px-6 border-t border-white/5 z-10 bg-platinum-950/30">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-2xl mb-16 reveal-fade-in">
            <span className="font-mono text-[10px] uppercase tracking-widest text-sapphire-400">Escrow Workspace</span>
            <h2 className="font-serif text-4xl md:text-5xl font-light tracking-tight text-white mt-2">Manage your Agreements</h2>
            <p className="text-white/40 font-light mt-4">Draft semantic agreements, deposit escrow collateral, file proofs of delivery, or trigger the validation engine.</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Interactive Forms */}
            <div className="lg:col-span-6 glass-panel rounded-2xl p-6">
              <div className="flex space-x-1 border-b border-white/5 pb-4 mb-6">
                {[
                  ["create", "Create Escrow"],
                  ["claim", "File Claim"],
                  ["refund", "Request Refund"]
                ].map(([tab, label]) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab as any)}
                    className={`px-4 py-2 font-mono text-[10px] uppercase tracking-widest rounded-lg transition-all ${activeTab === tab ? "bg-white text-sapphire-950" : "text-white/50 hover:text-white"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {activeTab === "create" && (
                <div className="space-y-4">
                  <div className="font-mono text-[9px] uppercase text-white/40">Step 01 // Deposit Escrow</div>
                  <div>
                    <label className="block font-mono text-[9px] uppercase tracking-wider text-white/50 mb-2">Provider Address (Executing Party)</label>
                    <input
                      type="text"
                      placeholder="0x..."
                      value={createForm.provider}
                      onChange={(e) => setCreateForm({ ...createForm, provider: e.target.value })}
                      className="w-full bg-platinum-950/60 border border-white/10 rounded-xl px-4 py-3 text-sm text-white font-sans outline-none focus:border-sapphire-500 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block font-mono text-[9px] uppercase tracking-wider text-white/50 mb-2">Covenant Terms (Natural Language)</label>
                    <textarea
                      placeholder="e.g. The integration works cleanly and the API latency stays below 150ms."
                      value={createForm.covenant}
                      onChange={(e) => setCreateForm({ ...createForm, covenant: e.target.value })}
                      rows={3}
                      className="w-full bg-platinum-950/60 border border-white/10 rounded-xl px-4 py-3 text-sm text-white font-sans outline-none focus:border-sapphire-500 transition-colors resize-none"
                    />
                  </div>
                  <div>
                    <label className="block font-mono text-[9px] uppercase tracking-wider text-white/50 mb-2">Escrow Value (GEN tokens)</label>
                    <input
                      type="number"
                      placeholder="0.1"
                      value={createForm.amount}
                      onChange={(e) => setCreateForm({ ...createForm, amount: e.target.value })}
                      className="w-full bg-platinum-950/60 border border-white/10 rounded-xl px-4 py-3 text-sm text-white font-sans outline-none focus:border-sapphire-500 transition-colors"
                    />
                  </div>
                  <button
                    onClick={authenticated ? handleCreate : onConnect}
                    disabled={busy}
                    className="w-full py-4 rounded-xl font-mono text-[10px] uppercase tracking-widest bg-white text-sapphire-950 hover:bg-sapphire-300 transition-all disabled:opacity-40"
                  >
                    {busy ? "Signing..." : authenticated ? "Deploy & Fund Escrow" : "Connect Wallet"}
                  </button>
                </div>
              )}

              {activeTab === "claim" && (
                <div className="space-y-4">
                  <div className="font-mono text-[9px] uppercase text-white/40">Step 02 // Submit Completion Evidence</div>
                  <div>
                    <label className="block font-mono text-[9px] uppercase tracking-wider text-white/50 mb-2">Agreement ID</label>
                    <input
                      type="number"
                      placeholder="1"
                      value={claimForm.agreement_id}
                      onChange={(e) => setClaimForm({ ...claimForm, agreement_id: e.target.value })}
                      className="w-full bg-platinum-950/60 border border-white/10 rounded-xl px-4 py-3 text-sm text-white font-sans outline-none focus:border-sapphire-500 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block font-mono text-[9px] uppercase tracking-wider text-white/50 mb-2">Evidence Source URL</label>
                    <input
                      type="text"
                      placeholder="https://example.com/proof"
                      value={claimForm.evidence_url}
                      onChange={(e) => setClaimForm({ ...claimForm, evidence_url: e.target.value })}
                      className="w-full bg-platinum-950/60 border border-white/10 rounded-xl px-4 py-3 text-sm text-white font-sans outline-none focus:border-sapphire-500 transition-colors"
                    />
                  </div>
                  <button
                    onClick={authenticated ? handleClaim : onConnect}
                    disabled={busy}
                    className="w-full py-4 rounded-xl font-mono text-[10px] uppercase tracking-widest bg-white text-sapphire-950 hover:bg-sapphire-300 transition-all disabled:opacity-40"
                  >
                    {busy ? "Submitting..." : authenticated ? "Submit Proof of Fulfillment" : "Connect Wallet"}
                  </button>
                </div>
              )}

              {activeTab === "refund" && (
                <div className="space-y-4">
                  <div className="font-mono text-[9px] uppercase text-white/40">Provider Voluntary Refund (Skip AI Arbitration)</div>
                  <div>
                    <label className="block font-mono text-[9px] uppercase tracking-wider text-white/50 mb-2">Agreement ID</label>
                    <input
                      type="number"
                      placeholder="1"
                      value={refundForm.agreement_id}
                      onChange={(e) => setRefundForm({ ...refundForm, agreement_id: e.target.value })}
                      className="w-full bg-platinum-950/60 border border-white/10 rounded-xl px-4 py-3 text-sm text-white font-sans outline-none focus:border-sapphire-500 transition-colors"
                    />
                  </div>
                  <button
                    onClick={authenticated ? handleRefund : onConnect}
                    disabled={busy}
                    className="w-full py-4 rounded-xl font-mono text-[10px] uppercase tracking-widest bg-white text-sapphire-950 hover:bg-sapphire-300 transition-all disabled:opacity-40"
                  >
                    {busy ? "Authorizing..." : authenticated ? "Trigger Voluntary Refund" : "Connect Wallet"}
                  </button>
                </div>
              )}
            </div>

            {/* CLI Console */}
            <div className="lg:col-span-6 glass-panel rounded-2xl overflow-hidden flex flex-col min-h-[460px]">
              <div className="bg-platinum-950/80 px-6 py-4 flex items-center justify-between border-b border-white/5">
                <div className="flex items-center space-x-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500/35" />
                  <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/35" />
                  <span className="w-2.5 h-2.5 rounded-full bg-sapphire-500/35" />
                  <span className="font-mono text-[10px] text-white/30 pl-4">console@sensusescrow</span>
                </div>
              </div>
              <div ref={consoleScreenRef} className="flex-1 p-6 bg-platinum-950/95 font-mono text-xs space-y-2 overflow-y-auto max-h-[300px]">
                {consoleLines.map((l, i) => (
                  <div key={i} className={l.k === "system" ? "text-sapphire-300" : l.k === "err" ? "text-red-400" : l.k === "dim" ? "text-white/30" : l.k === "cmd" ? "text-white/50 mt-3" : "text-white/80"}>
                    {l.k === "cmd" ? <><span className="text-sapphire-400 font-bold">❯</span> {l.t}</> : <span style={{ whiteSpace: "pre-wrap" }}>{l.t}</span>}
                  </div>
                ))}
              </div>
              <div className="bg-platinum-950/80 p-4 border-t border-white/5 flex items-center space-x-3">
                <span className="text-sapphire-400 font-mono text-sm pl-2">❯</span>
                <input
                  type="text"
                  value={consoleInput}
                  disabled={busy}
                  onChange={(e) => setConsoleInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && runConsoleCommand(consoleInput)}
                  placeholder={busy ? "Processing transaction..." : "/help · /list · /crank <id>"}
                  className="w-full bg-transparent outline-none border-none text-white font-mono text-xs placeholder-white/20"
                />
                <button
                  onClick={() => runConsoleCommand(consoleInput)}
                  disabled={busy}
                  className="px-4 py-2 bg-sapphire-500/10 hover:bg-sapphire-500/20 text-sapphire-300 border border-sapphire-500/20 rounded-lg text-[10px] font-mono uppercase tracking-wider transition-all disabled:opacity-40"
                >
                  Run
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Docket */}
      <section id="docket" className="relative py-24 px-6 border-t border-white/5 z-10">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-6 reveal-fade-in">
            <div>
              <span className="font-mono text-[10px] uppercase tracking-widest text-sapphire-400">Verifiable Agreements</span>
              <h2 className="font-serif text-4xl md:text-5xl font-light tracking-tight text-white mt-2">The Agreement Docket</h2>
            </div>
            <button
              onClick={refresh}
              className="px-5 py-2.5 border border-white/10 hover:border-sapphire-500/50 text-white/70 hover:text-sapphire-300 rounded-xl font-mono text-[10px] uppercase tracking-widest transition-all"
            >
              ↻ Sync from Chain
            </button>
          </div>

          <div className="glass-panel rounded-2xl overflow-x-auto shadow-2xl reveal-fade-in">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/5 bg-white/[0.01]">
                  {["Agreement", "Covenant Terms", "Escrow Amount", "Verdict & Status", "Action"].map((h) => (
                    <th key={h} className="font-mono text-[10px] uppercase tracking-widest text-white/35 py-5 px-6 font-normal">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-sans">
                {agreements.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 px-6 text-white/30 font-mono text-xs">No active escrow agreements found on-chain. Draft one using the workspace.</td>
                  </tr>
                ) : (
                  agreements.map((a) => {
                    const tx = txOf(a.agreement_id);
                    return (
                      <tr key={a.agreement_id} className="hover:bg-white/[0.01] transition-colors">
                        <td className="py-5 px-6 font-mono text-xs">
                          <span className="text-white/40">#{a.agreement_id}</span>
                          <div className="text-[10px] text-white/20 mt-1 flex flex-col">
                            <span>Client: {short(a.client)}</span>
                            <span>Provider: {short(a.provider)}</span>
                          </div>
                        </td>
                        <td className="py-5 px-6 max-w-md">
                          <span className="text-sm font-light text-white">{a.covenant_text}</span>
                          {a.rationale && (
                            <div className="text-xs text-white/30 italic mt-2 border-l border-white/10 pl-3">
                              “{a.rationale}”
                            </div>
                          )}
                          {a.evidence_url && (
                            <div className="text-[10px] font-mono text-sapphire-300 mt-2">
                              Evidence: <a href={a.evidence_url} target="_blank" rel="noopener noreferrer" className="hover:underline">{a.evidence_url}</a>
                            </div>
                          )}
                        </td>
                        <td className="py-5 px-6 font-mono text-sm text-white/80">{formatWei(a.amount)}</td>
                        <td className="py-5 px-6">
                          <span className={`inline-block px-2 py-0.5 rounded font-mono text-[9px] uppercase tracking-widest ${a.verdict === "PASS" ? "bg-sapphire-500/10 text-sapphire-300" : a.verdict === "FAIL" ? "bg-red-500/10 text-red-400" : "bg-white/5 text-white/40"}`}>{a.verdict}</span>
                          <div className="text-[10px] font-mono text-white/30 mt-1">{a.status}</div>
                        </td>
                        <td className="py-5 px-6">
                          {a.status === "CLAIMED" && (
                            <button
                              onClick={() => executeTx("crank", [a.agreement_id])}
                              disabled={busy}
                              className="px-3.5 py-2 rounded-lg font-mono text-[10px] uppercase tracking-wider bg-sapphire-500/15 text-sapphire-300 border border-sapphire-500/30 hover:bg-sapphire-500/25 transition-all disabled:opacity-40"
                            >
                              ⚖ Crank AI
                            </button>
                          )}
                          {a.status === "ACTIVE" && (
                            <span className="font-mono text-[10px] text-white/30">Waiting for claim</span>
                          )}
                          {(a.status === "RESOLVED" || a.status === "REFUNDED") && (
                            <span className="font-mono text-[10px] text-white/20 uppercase tracking-widest">Settled</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative py-12 px-6 border-t border-white/5 bg-platinum-950/80 z-10">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 font-mono text-[9px] uppercase tracking-[0.2em] text-white/30">
          <span>© 2026 SensusEscrow · Consensus-Arbitrated Escrow Agreement Protocol</span>
          <a href={`${EXPLORER}/address/${CONTRACT}`} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">{short(CONTRACT)}</a>
        </div>
      </footer>

      {/* Toast System */}
      <div className="fixed bottom-6 right-6 space-y-3 z-[100] max-w-sm">
        {toasts.map((t) => (
          <div key={t.id} className="glass-panel p-4 rounded-xl flex items-center space-x-3 text-xs font-mono shadow-xl bg-platinum-950/90">
            <div className="w-1.5 h-1.5 rounded-full bg-sapphire-400 animate-pulse" />
            <div className="text-white/80">{t.m}</div>
          </div>
        ))}
      </div>
    </>
  );
}
