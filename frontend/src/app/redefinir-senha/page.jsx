"use client";

import { useState, useEffect } from "react";

const apiBase = () =>
  (typeof window !== "undefined" && window.ENV_API_URL) ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:8001";

const api = async (path, opts = {}) => {
  const r = await fetch(`${apiBase()}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (!r.ok) {
    let detail = `API ${r.status}`;
    try {
      const j = await r.json();
      if (j?.detail) detail = typeof j.detail === "string" ? j.detail : JSON.stringify(j.detail);
    } catch (_) {}
    throw new Error(detail);
  }
  return r.json();
};

const Shell = ({ title, subtitle, badge = "Conexão segura", children }) => (
  <section
    className="relative min-h-screen w-full flex items-center justify-center overflow-hidden isolate p-[clamp(1rem,3.5vw,2.5rem)]"
    style={{
      background:
        "radial-gradient(ellipse 70% 50% at 75% 25%, rgba(0,231,252,0.12), transparent 60%)," +
        "radial-gradient(ellipse 60% 45% at 18% 85%, rgba(0,255,106,0.08), transparent 60%)," +
        "linear-gradient(180deg, #0a1418 0%, #04090b 100%)",
    }}
  >
    <div className="pointer-events-none absolute inset-0 z-0" aria-hidden="true">
      <div
        className="absolute rounded-full blur-[90px] opacity-55"
        style={{ top: "-15%", right: "-10%", width: 520, height: 520, background: "radial-gradient(circle, rgba(0,231,252,0.28), transparent 65%)" }}
      />
      <div
        className="absolute rounded-full blur-[90px] opacity-50"
        style={{ bottom: "-20%", left: "-12%", width: 460, height: 460, background: "radial-gradient(circle, rgba(0,255,106,0.14), transparent 60%)" }}
      />
    </div>

    <main className="relative z-10 w-full max-w-[440px] overflow-hidden flex flex-col gap-5 rounded-[22px] p-[clamp(1.75rem,3.5vw,2.5rem)] border border-white/[0.07] backdrop-blur-2xl bg-[#0d181c]/[0.78] shadow-[0_24px_70px_-24px_rgba(0,0,0,0.7),0_8px_32px_-12px_rgba(0,231,252,0.15)]">
      <div className="pointer-events-none absolute top-0 left-[15%] right-[15%] h-px" style={{ background: "linear-gradient(90deg, transparent 0%, rgba(0,231,252,0.5) 50%, transparent 100%)" }} />
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#00e7fc] to-[#00ff4d] flex items-center justify-center text-[#06262b] font-extrabold">IP</div>
        <span className="text-[#00ff6a] font-extrabold tracking-[0.32em] text-sm">IMOBPRO</span>
      </div>
      <header className="flex flex-col gap-2">
        <span className="inline-flex items-center gap-1.5 w-fit px-2.5 py-1.5 rounded-full bg-[#00e7fc]/[0.08] border border-[#00e7fc]/20 text-[#00e7fc] text-[0.7rem] font-semibold uppercase tracking-[0.1em]">
          {badge}
        </span>
        <h1 className="text-[1.55rem] font-semibold tracking-tight text-white leading-tight">{title}</h1>
        {subtitle && <p className="text-sm text-slate-400">{subtitle}</p>}
      </header>
      {children}
    </main>
  </section>
);

const PasswordInput = ({ id, label, value, onChange, placeholder }) => {
  const [show, setShow] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-[0.8rem] font-medium text-slate-300">{label}</label>
      <div className="relative flex items-center">
        <input
          id={id}
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete="new-password"
          className="w-full h-[54px] pl-4 pr-12 rounded-xl tech-input text-[0.95rem]"
          placeholder={placeholder}
          required
        />
        <button type="button" onClick={() => setShow((v) => !v)} tabIndex={-1}
          aria-label={show ? "Ocultar senha" : "Mostrar senha"}
          className="absolute right-2 w-9 h-9 grid place-items-center rounded-lg text-slate-500 hover:text-slate-200 hover:bg-white/5 transition-colors">
          {show ? "🙈" : "👁"}
        </button>
      </div>
    </div>
  );
};

export default function RedefinirSenhaPage() {
  const [token, setToken] = useState(null);
  const [estado, setEstado] = useState("validando"); // validando | valido | invalido | sucesso
  const [erroLink, setErroLink] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("token") || "";
    setToken(t);
    if (!t) {
      setEstado("invalido");
      setErroLink("Link inválido. Solicite uma nova redefinição de senha.");
      return;
    }
    (async () => {
      try {
        await api("/api/auth/redefinir-senha/validar", { method: "POST", body: JSON.stringify({ token: t }) });
        setEstado("valido");
      } catch (e) {
        setEstado("invalido");
        setErroLink(e.message || "Este link é inválido ou já foi utilizado.");
      }
    })();
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setErro("");
    if (senha !== confirmar) { setErro("As senhas não conferem."); return; }
    if (senha.length < 8) { setErro("A senha deve ter ao menos 8 caracteres."); return; }
    setLoading(true);
    try {
      await api("/api/auth/redefinir-senha", {
        method: "POST",
        body: JSON.stringify({ token, senha, confirmar_senha: confirmar }),
      });
      setEstado("sucesso");
    } catch (err) {
      setErro(err.message || "Não foi possível redefinir a senha.");
    } finally {
      setLoading(false);
    }
  };

  if (estado === "validando") {
    return (
      <Shell title="Redefinir senha" badge="Verificando">
        <div className="flex items-center gap-3 text-slate-400 text-sm">
          <span className="w-4 h-4 rounded-full border-2 border-slate-600 border-t-[#00e7fc] animate-spin" />
          Validando o link...
        </div>
      </Shell>
    );
  }

  if (estado === "invalido") {
    return (
      <Shell title="Link inválido" badge="Recuperar acesso">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="w-14 h-14 rounded-2xl bg-rose-500/15 text-rose-300 grid place-items-center text-2xl font-bold">!</div>
          <p className="text-sm leading-relaxed text-slate-300">{erroLink}</p>
          <a href="/" className="mt-1 w-full h-[50px] inline-flex items-center justify-center rounded-xl tech-button text-[0.95rem]">
            Voltar ao login
          </a>
        </div>
      </Shell>
    );
  }

  if (estado === "sucesso") {
    return (
      <Shell title="Senha redefinida" badge="Tudo certo">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="w-14 h-14 rounded-2xl bg-[#00ff6a]/15 text-[#00ff6a] grid place-items-center text-2xl font-bold">✓</div>
          <p className="text-sm leading-relaxed text-slate-300">
            Sua senha foi redefinida com sucesso. Você já pode acessar o sistema.
          </p>
          <a href="/" className="mt-1 w-full h-[50px] inline-flex items-center justify-center rounded-xl tech-button text-[0.95rem]">
            Ir para o login
          </a>
        </div>
      </Shell>
    );
  }

  return (
    <Shell title="Criar nova senha" subtitle="Defina uma nova senha para acessar sua conta." badge="Recuperar acesso">
      {erro && (
        <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-rose-500/[0.08] border border-rose-500/25 text-rose-300 text-sm leading-snug" role="alert">
          <span>{erro}</span>
        </div>
      )}
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <PasswordInput id="nova-senha" label="Nova senha" value={senha} onChange={setSenha} placeholder="Mínimo de 8 caracteres" />
        <PasswordInput id="confirmar-senha" label="Confirmar nova senha" value={confirmar} onChange={setConfirmar} placeholder="Repita a nova senha" />
        <button type="submit" disabled={loading}
          className="relative w-full h-[54px] inline-flex items-center justify-center gap-2 rounded-xl tech-button text-[0.95rem] disabled:opacity-55 disabled:cursor-not-allowed">
          {loading ? (
            <><span className="w-4 h-4 rounded-full border-2 border-[#06262b]/40 border-t-[#06262b] animate-spin" /> Salvando...</>
          ) : "Redefinir senha"}
        </button>
      </form>
    </Shell>
  );
}
