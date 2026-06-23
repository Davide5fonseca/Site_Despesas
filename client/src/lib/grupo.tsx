import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, Membro, getMembroAtual } from "../api/client";

// Contexto único do grupo atual. Carrega os membros uma vez após a entrada e
// expõe tudo o que a UI condicional precisa:
//   - solo: o grupo tem 0/1 membros (esconde Pessoas, "Dividir por", etc.)
//   - membroAtualId: o "eu" deste dispositivo (default em "Quem pagou")
// Uma app, um modelo de dados — a diferença solo vs. grupo é só isto.
interface GrupoCtx {
  membros: Membro[];
  solo: boolean;
  membroAtualId: number | null;
  carregado: boolean;
  recarregar: () => Promise<void>;
}

const Ctx = createContext<GrupoCtx | null>(null);

export function GrupoProvider({ children }: { children: React.ReactNode }) {
  const [membros, setMembros] = useState<Membro[]>([]);
  const [carregado, setCarregado] = useState(false);

  const recarregar = useCallback(async () => {
    try {
      setMembros(await api.listarMembros());
    } catch {
      /* mantém o que houver */
    } finally {
      setCarregado(true);
    }
  }, []);

  useEffect(() => {
    recarregar();
    // Volta a sincronizar quando a app reganha foco — assim o flag `solo` não
    // fica desatualizado se outro dispositivo adicionou/removeu um membro.
    const aoFocar = () => recarregar();
    const aoVisivel = () => {
      if (document.visibilityState === "visible") recarregar();
    };
    window.addEventListener("focus", aoFocar);
    document.addEventListener("visibilitychange", aoVisivel);
    return () => {
      window.removeEventListener("focus", aoFocar);
      document.removeEventListener("visibilitychange", aoVisivel);
    };
  }, [recarregar]);

  const solo = membros.length <= 1;

  // "Eu": o membro guardado (se ainda existir), senão o único membro (solo),
  // senão desconhecido (grupo onde entrei por código).
  const guardado = getMembroAtual();
  const membroAtualId =
    guardado != null && membros.some((m) => m.id === guardado)
      ? guardado
      : membros.length === 1
      ? membros[0].id
      : null;

  return (
    <Ctx.Provider value={{ membros, solo, membroAtualId, carregado, recarregar }}>
      {children}
    </Ctx.Provider>
  );
}

export function useGrupo(): GrupoCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useGrupo() tem de estar dentro de <GrupoProvider>");
  return c;
}
