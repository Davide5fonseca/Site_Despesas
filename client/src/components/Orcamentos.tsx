import { useEffect, useState } from "react";
import { api, Categoria, Orcamento, getFamilia, setFamilia } from "../api/client";
import { formatarNumero, parseEurosParaCentimos } from "../lib/format";

interface Props {
  categorias: Categoria[];
}

// Rendimento mensal + orçamentos (total e por categoria). Tudo em cêntimos no
// servidor; aqui edita-se em euros com vírgula. Guarda ao sair do campo.
export default function Orcamentos({ categorias }: Props) {
  const [rendimento, setRendimento] = useState("");
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [edicao, setEdicao] = useState<Record<string, string>>({}); // chave: "t" ou id
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    api
      .familiaAtual()
      .then((f) => {
        setFamilia({ ...(getFamilia() ?? f), ...f, token: getFamilia()?.token });
        if (f.rendimento_centimos != null) setRendimento(formatarNumero(f.rendimento_centimos));
      })
      .catch(() => {});
    api.listarOrcamentos().then(setOrcamentos).catch(() => {});
  }, []);

  const valorDe = (categoriaId: number | null) =>
    orcamentos.find((o) => o.categoria_id === categoriaId)?.valor_centimos ?? null;

  const chave = (categoriaId: number | null) => (categoriaId == null ? "t" : String(categoriaId));

  function textoDe(categoriaId: number | null): string {
    const k = chave(categoriaId);
    if (k in edicao) return edicao[k];
    const v = valorDe(categoriaId);
    return v != null ? formatarNumero(v) : "";
  }

  async function guardarOrcamento(categoriaId: number | null) {
    const k = chave(categoriaId);
    if (!(k in edicao)) return;
    const texto = edicao[k].trim();
    const centimos = texto === "" ? null : parseEurosParaCentimos(texto);
    if (texto !== "" && centimos === null) return setErro("Valor inválido (ex.: 250 ou 250,50).");
    setErro(null);
    try {
      setOrcamentos(await api.definirOrcamento(categoriaId, centimos));
      setEdicao((e) => {
        const { [k]: _, ...resto } = e;
        return resto;
      });
      mostrarAviso("Orçamento guardado.");
    } catch (e: any) {
      setErro(e?.message || "Não foi possível guardar.");
    }
  }

  async function guardarRendimento() {
    const texto = rendimento.trim();
    const centimos = texto === "" ? null : parseEurosParaCentimos(texto);
    if (texto !== "" && centimos === null) return setErro("Valor inválido (ex.: 1500).");
    setErro(null);
    try {
      const f = await api.atualizarFamilia({ rendimento_centimos: centimos });
      setFamilia({ ...(getFamilia() ?? f), ...f, token: getFamilia()?.token });
      mostrarAviso(centimos == null ? "Rendimento removido." : "Rendimento guardado.");
    } catch (e: any) {
      setErro(e?.message || "Não foi possível guardar.");
    }
  }

  function mostrarAviso(t: string) {
    setAviso(t);
    window.setTimeout(() => setAviso(null), 1800);
  }

  const somaCategorias = categorias.reduce((s, c) => s + (valorDe(c.id) ?? 0), 0);
  const total = valorDe(null);

  return (
    <section className="cartao p-5">
      <h2 className="mb-1 text-xs font-bold uppercase tracking-wider text-slate-400">Poupança e orçamentos</h2>
      <p className="mb-4 text-sm text-slate-400">
        Define quanto entra por mês e quanto queres gastar. O Resumo mostra o que sobra e avisa quando
        te aproximas do limite.
      </p>

      <div className="space-y-4">
        <div>
          <label className="rotulo">Rendimento mensal (€)</label>
          <input
            className="campo"
            inputMode="decimal"
            placeholder="ex.: 1500"
            value={rendimento}
            onChange={(e) => setRendimento(e.target.value)}
            onBlur={guardarRendimento}
            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          />
          <p className="mt-1 text-xs text-slate-500">
            Só para calcular a poupança (rendimento − gastos). Fica guardado no grupo.
          </p>
        </div>

        <div>
          <label className="rotulo">Orçamento total do mês (€)</label>
          <input
            className="campo"
            inputMode="decimal"
            placeholder="sem limite"
            value={textoDe(null)}
            onChange={(e) => setEdicao((ed) => ({ ...ed, t: e.target.value }))}
            onBlur={() => guardarOrcamento(null)}
            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          />
        </div>

        <div>
          <label className="rotulo">Por categoria (€ / mês)</label>
          <ul className="space-y-2">
            {categorias.map((c) => (
              <li key={c.id} className="flex items-center gap-3 rounded-xl bg-noite-900/50 px-3 py-2">
                <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: c.cor }} />
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-100">{c.nome}</span>
                <input
                  className="campo w-28 py-1.5 text-right"
                  inputMode="decimal"
                  placeholder="—"
                  aria-label={`Orçamento ${c.nome}`}
                  value={textoDe(c.id)}
                  onChange={(e) => setEdicao((ed) => ({ ...ed, [c.id]: e.target.value }))}
                  onBlur={() => guardarOrcamento(c.id)}
                  onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                />
              </li>
            ))}
          </ul>
          {total != null && somaCategorias > total && (
            <p className="mt-2 text-xs text-amber-300">
              A soma das categorias ({formatarNumero(somaCategorias)} €) passa o orçamento total (
              {formatarNumero(total)} €).
            </p>
          )}
        </div>
      </div>

      {erro && (
        <p className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {erro}
        </p>
      )}
      {aviso && <p className="mt-3 text-center text-xs font-medium text-marcatxt">{aviso}</p>}
    </section>
  );
}
