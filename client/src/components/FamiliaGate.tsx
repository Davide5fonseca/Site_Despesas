import { useState } from "react";
import { api, Familia, setFamilia } from "../api/client";
import BotaoTema from "./BotaoTema";

interface Props {
  onPronto: (f: Familia) => void;
}

export default function FamiliaGate({ onPronto }: Props) {
  const [nome, setNome] = useState("");
  const [codigo, setCodigo] = useState("");
  const [criada, setCriada] = useState<Familia | null>(null);
  const [aCarregar, setACarregar] = useState<"criar" | "entrar" | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function criar() {
    if (!nome.trim()) return setErro("Dá um nome à tua família.");
    setErro(null);
    setACarregar("criar");
    try {
      const f = await api.criarFamilia(nome.trim());
      setFamilia(f);
      setCriada(f); // mostra o código antes de entrar
    } catch (e: any) {
      setErro(e?.message || "Não foi possível criar a família.");
    } finally {
      setACarregar(null);
    }
  }

  async function entrar() {
    if (codigo.trim().length < 4) return setErro("Escreve o código que te deram.");
    setErro(null);
    setACarregar("entrar");
    try {
      const f = await api.entrarFamilia(codigo);
      setFamilia(f);
      onPronto(f);
    } catch (e: any) {
      setErro(e?.message || "Código inválido.");
    } finally {
      setACarregar(null);
    }
  }

  async function copiar(texto: string) {
    try {
      await navigator.clipboard.writeText(texto);
    } catch {
      /* sem clipboard */
    }
  }

  // Ecrã pós-criação: mostra o código para partilhar
  if (criada) {
    return (
      <Camada>
        <div className="cartao p-6 text-center">
          <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-marca-500/15 text-marcatxt">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
              <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-slate-100">Família criada!</h2>
          <p className="mt-1 text-sm text-slate-400">
            Partilha este código com a tua casa. Quem o usar entra na mesma família.
          </p>

          <div className="my-5">
            <div className="rounded-2xl border border-dashed border-marca-500/40 bg-noite-900/50 py-5">
              <span className="text-3xl font-extrabold tracking-[0.3em] text-slate-100">
                {criada.codigo}
              </span>
            </div>
            <button className="botao-secundario mt-3 w-full" onClick={() => copiar(criada.codigo)}>
              Copiar código
            </button>
          </div>

          <button className="botao-primario w-full" onClick={() => onPronto(criada)}>
            Continuar
          </button>
        </div>
      </Camada>
    );
  }

  return (
    <Camada>
      <header className="mb-6 text-center">
        <div className="mx-auto mb-3 grid h-16 w-16 place-items-center rounded-2xl bg-marca-600 text-3xl font-extrabold text-white shadow-cartao">
          €
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-100">Despesas da Casa</h1>
        <p className="text-sm text-slate-400">Cria a tua família ou entra com um código.</p>
      </header>

      {erro && (
        <p className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {erro}
        </p>
      )}

      {/* Criar família */}
      <section className="cartao mb-4 p-5">
        <h2 className="mb-1 text-base font-bold text-slate-100">Criar família nova</h2>
        <p className="mb-3 text-sm text-slate-400">Recebes um código para partilhar com os outros.</p>
        <input
          className="campo mb-3"
          placeholder="Nome (ex.: Casa dos Silva)"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && criar()}
        />
        <button className="botao-primario w-full" onClick={criar} disabled={aCarregar !== null}>
          {aCarregar === "criar" ? "A criar…" : "Criar família"}
        </button>
      </section>

      <div className="my-4 flex items-center gap-3 text-xs text-slate-500">
        <span className="h-px flex-1 bg-linha/10" /> OU <span className="h-px flex-1 bg-linha/10" />
      </div>

      {/* Entrar com código */}
      <section className="cartao p-5">
        <h2 className="mb-1 text-base font-bold text-slate-100">Entrar com código</h2>
        <p className="mb-3 text-sm text-slate-400">Já alguém da casa criou? Mete aqui o código.</p>
        <input
          className="campo mb-3 text-center text-xl font-bold uppercase tracking-[0.25em]"
          placeholder="CÓDIGO"
          maxLength={12}
          value={codigo}
          onChange={(e) => setCodigo(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === "Enter" && entrar()}
        />
        <button className="botao-secundario w-full" onClick={entrar} disabled={aCarregar !== null}>
          {aCarregar === "entrar" ? "A entrar…" : "Entrar"}
        </button>
      </section>

      <div className="mt-6 flex justify-center">
        <BotaoTema />
      </div>
    </Camada>
  );
}

function Camada({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-10">
      <div className="w-full">{children}</div>
    </div>
  );
}
