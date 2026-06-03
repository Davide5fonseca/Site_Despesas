import { useEffect, useRef, useState } from "react";
import { api, Categoria, TalaoExtraido } from "../api/client";
import { comprimirImagem } from "../lib/imagem";
import { lerTalaoLocal } from "../lib/ocrTalao";

interface Props {
  categorias: Categoria[];
  onExtraido: (dados: TalaoExtraido, previewUrl: string) => void;
  onFechar: () => void;
}

type Estado = "espera" | "a_comprimir" | "a_ler" | "erro";

export default function ScanTalao({ categorias, onExtraido, onFechar }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [estado, setEstado] = useState<Estado>("espera");
  const [erro, setErro] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [progresso, setProgresso] = useState(0);
  // null = ainda a verificar; true = IA na nuvem; false = OCR no telemóvel
  const [usarIA, setUsarIA] = useState<boolean | null>(null);

  // Descobre se o servidor tem IA configurada. Se não, usa OCR local (grátis).
  useEffect(() => {
    api
      .saude()
      .then((s) => setUsarIA(s.ia))
      .catch(() => setUsarIA(false));
  }, []);

  async function aoEscolher(e: React.ChangeEvent<HTMLInputElement>) {
    const ficheiro = e.target.files?.[0];
    if (!ficheiro) return;
    setErro(null);
    setProgresso(0);

    try {
      setEstado("a_comprimir");
      const comprimida = await comprimirImagem(ficheiro);
      const url = URL.createObjectURL(comprimida);
      setPreview(url);

      setEstado("a_ler");
      const nomes = categorias.map((c) => c.nome);
      const dados = usarIA
        ? await api.lerTalao(comprimida)
        : await lerTalaoLocal(comprimida, nomes, (p) => setProgresso(p));

      onExtraido(dados, url);
    } catch (err: any) {
      setEstado("erro");
      setErro(
        err?.message ||
          "Não foi possível ler o talão. Tenta outra foto ou introduz manualmente."
      );
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const aProcessar = estado === "a_comprimir" || estado === "a_ler";
  const pctOCR = estado === "a_ler" && !usarIA ? ` ${Math.round(progresso * 100)}%` : "";

  return (
    <div className="space-y-4">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={aoEscolher}
      />

      <button
        onClick={() => inputRef.current?.click()}
        disabled={aProcessar}
        className="flex w-full flex-col items-center justify-center gap-3 rounded-2xl
          border-2 border-dashed border-marca-500/40 bg-noite-900/50 px-6 py-10
          text-center transition hover:border-marca-400 disabled:opacity-60"
      >
        {preview ? (
          <img src={preview} alt="Pré-visualização do talão" className="max-h-44 rounded-xl object-contain" />
        ) : (
          <span className="grid h-16 w-16 place-items-center rounded-full bg-marca-500/15 text-marcatxt">
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none">
              <path
                d="M3 8.5A2.5 2.5 0 0 1 5.5 6h1.2c.5 0 .96-.27 1.2-.7l.5-.86A1.5 1.5 0 0 1 10.6 3.7h2.8a1.5 1.5 0 0 1 1.3.74l.5.86c.24.43.7.7 1.2.7h1.1A2.5 2.5 0 0 1 21 8.5v8A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5v-8Z"
                stroke="currentColor"
                strokeWidth="1.7"
              />
              <circle cx="12" cy="12.5" r="3.2" stroke="currentColor" strokeWidth="1.7" />
            </svg>
          </span>
        )}
        <span className="font-semibold text-slate-100">
          {preview ? "Tocar para tirar outra foto" : "Fotografar talão"}
        </span>
        <span className="text-sm text-slate-400">
          A câmara abre diretamente. Também podes escolher da galeria.
        </span>
      </button>

      {aProcessar && (
        <div className="flex items-center justify-center gap-3 rounded-2xl bg-noite-900/60 px-4 py-3 text-marcatxt">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-marca-400 border-t-transparent" />
          <span className="text-sm font-medium">
            {estado === "a_comprimir"
              ? "A preparar a imagem…"
              : usarIA
              ? "A ler o talão com IA…"
              : `A ler o talão no telemóvel…${pctOCR}`}
          </span>
        </div>
      )}

      {erro && (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {erro}
        </p>
      )}

      <p className="text-center text-xs text-slate-500">
        {usarIA === false
          ? "Leitura feita no teu telemóvel (grátis). Extrai valor, data e loja — confirmas tudo antes de gravar. Na 1.ª vez descarrega o idioma (precisa de internet uma vez)."
          : "A IA extrai valor, loja, data e sugere a categoria. Confirmas tudo antes de gravar."}
        <br />
        Nota: no iPhone, a câmara exige HTTPS.
      </p>

      <button className="botao-secundario w-full" onClick={onFechar} disabled={aProcessar}>
        Cancelar
      </button>
    </div>
  );
}
