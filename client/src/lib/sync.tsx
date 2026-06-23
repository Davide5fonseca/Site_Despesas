import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { DespesaInput, postDespesaSync } from "../api/client";
import { filaAdicionar, filaListar, filaRemover, ItemFila } from "./filaSync";

interface SyncCtx {
  itens: ItemFila[]; // despesas por sincronizar (todos os grupos)
  pendentes: number;
  sincronizando: boolean;
  online: boolean;
  sincronizadoEm: number; // timestamp da última sincronização com sucesso
  avisosDup: number[]; // ids de despesas sinalizadas como possível talão repetido
  enfileirar: (payload: DespesaInput, codigo: string) => Promise<void>;
  sincronizar: () => Promise<void>;
  descartar: (clienteId: string) => Promise<void>;
  descartarAviso: (despesaId: number) => void; // marca o aviso como revisto/ignorado
}

const Ctx = createContext<SyncCtx | null>(null);

const AVISOS_KEY = "despesas_avisos_dup";
function carregarAvisos(): number[] {
  try {
    const a = JSON.parse(localStorage.getItem(AVISOS_KEY) || "[]");
    return Array.isArray(a) ? a.filter((x) => Number.isInteger(x)) : [];
  } catch {
    return [];
  }
}
function guardarAvisos(a: number[]) {
  try {
    localStorage.setItem(AVISOS_KEY, JSON.stringify(a));
  } catch {
    /* sem storage */
  }
}

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const [itens, setItens] = useState<ItemFila[]>([]);
  const [sincronizando, setSincronizando] = useState(false);
  const [online, setOnline] = useState<boolean>(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [sincronizadoEm, setSincronizadoEm] = useState(0);
  const [avisosDup, setAvisosDup] = useState<number[]>(carregarAvisos);
  const aCorrer = useRef(false); // evita sincronizações concorrentes

  const recarregar = useCallback(async () => {
    try {
      setItens(await filaListar());
    } catch {
      /* IndexedDB indisponível — ignora */
    }
  }, []);

  const adicionarAviso = useCallback((id: number) => {
    setAvisosDup((prev) => {
      if (prev.includes(id)) return prev;
      const n = [...prev, id];
      guardarAvisos(n);
      return n;
    });
  }, []);

  const descartarAviso = useCallback((id: number) => {
    setAvisosDup((prev) => {
      const n = prev.filter((x) => x !== id);
      guardarAvisos(n);
      return n;
    });
  }, []);

  const sincronizar = useCallback(async () => {
    if (aCorrer.current || !navigator.onLine) return;
    aCorrer.current = true;
    setSincronizando(true);
    let mudou = false;
    try {
      const fila = await filaListar();
      for (const item of fila) {
        let res: { status: number; corpo: any };
        try {
          res = await postDespesaSync(item.codigo, item.payload);
        } catch {
          break; // sem rede / falhou — tenta mais tarde, mantém a ordem
        }
        if (res.status >= 200 && res.status < 300) {
          // Sinal de talão duplicado (não bloqueia): marca a despesa para revisão.
          if (res.corpo?.duplicado_talao && Number.isInteger(res.corpo?.id)) {
            adicionarAviso(res.corpo.id);
          }
          await filaRemover(item.clienteId); // sucesso (server idempotente p/ cliente_id)
          mudou = true;
        } else if (res.status >= 400 && res.status < 500) {
          await filaRemover(item.clienteId); // pedido inválido — não vai singrar, remove
          mudou = true;
        } else {
          break; // 5xx — problema temporário do servidor, tenta depois
        }
      }
    } finally {
      aCorrer.current = false;
      setSincronizando(false);
      await recarregar();
      if (mudou) setSincronizadoEm(Date.now());
    }
  }, [recarregar, adicionarAviso]);

  const enfileirar = useCallback(
    async (payload: DespesaInput, codigo: string) => {
      const clienteId = payload.cliente_id ?? `c-${Date.now()}`;
      await filaAdicionar({ clienteId, codigo, payload, criadoEm: Date.now() });
      await recarregar();
      if (navigator.onLine) sincronizar(); // pode ter sido falha transitória
    },
    [recarregar, sincronizar]
  );

  const descartar = useCallback(
    async (clienteId: string) => {
      await filaRemover(clienteId);
      await recarregar();
    },
    [recarregar]
  );

  useEffect(() => {
    recarregar();
    const aoOnline = () => {
      setOnline(true);
      sincronizar();
    };
    const aoOffline = () => setOnline(false);
    const aoVisivel = () => {
      if (document.visibilityState === "visible" && navigator.onLine) sincronizar();
    };
    window.addEventListener("online", aoOnline);
    window.addEventListener("offline", aoOffline);
    document.addEventListener("visibilitychange", aoVisivel);
    if (navigator.onLine) sincronizar();
    return () => {
      window.removeEventListener("online", aoOnline);
      window.removeEventListener("offline", aoOffline);
      document.removeEventListener("visibilitychange", aoVisivel);
    };
  }, [recarregar, sincronizar]);

  return (
    <Ctx.Provider
      value={{
        itens,
        pendentes: itens.length,
        sincronizando,
        online,
        sincronizadoEm,
        avisosDup,
        enfileirar,
        sincronizar,
        descartar,
        descartarAviso,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useSync(): SyncCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useSync() tem de estar dentro de <SyncProvider>");
  return c;
}
