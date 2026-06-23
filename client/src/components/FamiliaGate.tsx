import { useState } from "react";
import { api, Familia, setFamilia, setMembroAtual } from "../api/client";
import BotaoTema from "./BotaoTema";

interface Props {
  onPronto: (f: Familia) => void;
}

export default function FamiliaGate({ onPronto }: Props) {
  const [nomeSolo, setNomeSolo] = useState("");
  const [nomeGrupo, setNomeGrupo] = useState("");
  const [pin, setPin] = useState("");
  const [codigo, setCodigo] = useState("");
  const [pinEntrar, setPinEntrar] = useState("");
  const [precisaPin, setPrecisaPin] = useState(false);
  const [criada, setCriada] = useState<Familia | null>(null);
  const [aCarregar, setACarregar] = useState<"solo" | "criar" | "entrar" | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  // Caminho A — "Só para mim": cria silenciosamente um grupo de 1 membro e entra
  // direto, sem mostrar código nem PIN. Um utilizador solo é só um grupo de UM.
  async function comecarSolo() {
    setErro(null);
    setACarregar("solo");
    try {
      const n = nomeSolo.trim();
      const f = await api.criarFamilia(n || "As minhas despesas");
      setFamilia(f); // necessário para o cabeçalho do próximo pedido
      try {
        const m = await api.criarMembro(n || "Eu");
        setMembroAtual(m.id); // este membro é o "eu" deste dispositivo
      } catch {
        /* o grupo já existe; segue mesmo sem membro */
      }
      onPronto(f);
    } catch (e: any) {
      setErro(e?.message || "Não foi possível começar.");
    } finally {
      setACarregar(null);
    }
  }

  // Caminho B — "Criar grupo": mostra o código para partilhar.
  async function criarGrupo() {
    if (!nomeGrupo.trim()) return setErro("Dá um nome ao grupo.");
    if (pin && pin.trim().length < 4) return setErro("O PIN deve ter pelo menos 4 caracteres.");
    setErro(null);
    setACarregar("criar");
    try {
      const f = await api.criarFamilia(nomeGrupo.trim(), pin.trim() || undefined);
      setFamilia(f);
      setCriada(f); // mostra o código antes de entrar
    } catch (e: any) {
      setErro(e?.message || "Não foi possível criar o grupo.");
    } finally {
      setACarregar(null);
    }
  }

  // Caminho C — "Entrar com código".
  async function entrar() {
    if (codigo.trim().length < 4) return setErro("Escreve o código que te deram.");
    setErro(null);
    setACarregar("entrar");
    try {
      const f = await api.entrarFamilia(codigo, pinEntrar.trim() || undefined);
      setFamilia(f);
      onPronto(f);
    } catch (e: any) {
      if (e?.pinNecessario) setPrecisaPin(true);
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

  const ocupado = aCarregar !== null;

  // Ecrã pós-criação de grupo: mostra o código para partilhar.
  if (criada) {
    return (
      <Camada>
        <div className="cartao p-6 text-center">
          <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-marca-500/15 text-marcatxt">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
              <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-slate-100">Grupo criado!</h2>
          <p className="mt-1 text-sm text-slate-400">
            Partilha este código. Quem o usar entra no mesmo grupo.
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
        <div className="mx-auto mb-3 grid h-16 w-16 place-items-center overflow-hidden rounded-2xl bg-white shadow-cartao ring-1 ring-black/5">
          <img src="/logo.png" alt="ScanWise" className="h-full w-full object-contain p-1.5" />
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-100">ScanWise</h1>
        <p className="text-sm text-slate-400">
          Regista despesas sozinho ou partilha com quem quiseres.
        </p>
      </header>

      {erro && (
        <p className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {erro}
        </p>
      )}

      {/* Caminho A — Só para mim (em destaque) */}
      <section className="mb-4 rounded-xl2 border-2 border-marca-500/60 bg-noite-800 p-5 shadow-cartao">
        <div className="mb-1 flex items-center gap-2">
          <h2 className="text-base font-bold text-slate-100">Só para mim</h2>
          <span className="rounded-full bg-marca-500/15 px-2 py-0.5 text-[11px] font-semibold text-marcatxt">
            Mais rápido
          </span>
        </div>
        <p className="mb-3 text-sm text-slate-400">
          Começa já a registar. Podes convidar alguém mais tarde.
        </p>
        <input
          className="campo mb-3"
          placeholder="O teu nome (opcional)"
          value={nomeSolo}
          onChange={(e) => setNomeSolo(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && comecarSolo()}
        />
        <button className="botao-primario w-full" onClick={comecarSolo} disabled={ocupado}>
          {aCarregar === "solo" ? "A preparar…" : "Começar"}
        </button>
      </section>

      <div className="my-4 flex items-center gap-3 text-xs text-slate-500">
        <span className="h-px flex-1 bg-linha/10" /> ou com mais pessoas{" "}
        <span className="h-px flex-1 bg-linha/10" />
      </div>

      {/* Caminho B — Criar grupo */}
      <section className="cartao mb-4 p-5">
        <h2 className="mb-1 text-base font-bold text-slate-100">Criar grupo</h2>
        <p className="mb-3 text-sm text-slate-400">Recebes um código para partilhar com os outros.</p>
        <input
          className="campo mb-3"
          placeholder="Nome do grupo (ex.: Casa dos Silva)"
          value={nomeGrupo}
          onChange={(e) => setNomeGrupo(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && criarGrupo()}
        />
        <input
          className="campo mb-1"
          type="password"
          inputMode="numeric"
          placeholder="PIN (opcional, para proteger)"
          maxLength={12}
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && criarGrupo()}
        />
        <p className="mb-3 text-xs text-slate-500">
          Com PIN, só quem souber o código <span className="text-slate-400">e</span> o PIN entra.
        </p>
        <button className="botao-secundario w-full" onClick={criarGrupo} disabled={ocupado}>
          {aCarregar === "criar" ? "A criar…" : "Criar grupo"}
        </button>
      </section>

      {/* Caminho C — Entrar com código */}
      <section className="cartao p-5">
        <h2 className="mb-1 text-base font-bold text-slate-100">Entrar com código</h2>
        <p className="mb-3 text-sm text-slate-400">Já alguém criou um grupo? Mete aqui o código.</p>
        <input
          className="campo mb-3 text-center text-xl font-bold uppercase tracking-[0.25em]"
          placeholder="CÓDIGO"
          maxLength={12}
          value={codigo}
          onChange={(e) => setCodigo(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === "Enter" && entrar()}
        />
        {precisaPin && (
          <input
            className="campo mb-3 text-center text-lg font-bold tracking-[0.3em]"
            type="password"
            inputMode="numeric"
            placeholder="PIN"
            maxLength={12}
            autoFocus
            value={pinEntrar}
            onChange={(e) => setPinEntrar(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && entrar()}
          />
        )}
        <button className="botao-secundario w-full" onClick={entrar} disabled={ocupado}>
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
