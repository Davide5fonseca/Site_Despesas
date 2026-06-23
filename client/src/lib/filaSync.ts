import type { DespesaInput } from "../api/client";

// Fila local de despesas criadas sem rede (IndexedDB). Cada item tem um id de
// cliente (cliente_id) que serve de chave de idempotência: o servidor ignora
// repetições do mesmo cliente_id, por isso sincronizar duas vezes não duplica.
export interface ItemFila {
  clienteId: string; // = payload.cliente_id (chave do store e idempotência)
  codigo: string; // código do grupo onde foi criada (cabeçalho ao sincronizar)
  payload: DespesaInput;
  criadoEm: number;
}

const DB = "scanwise";
const STORE = "fila_despesas";
const VERSAO = 1;

function abrir(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, VERSAO);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "clienteId" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function filaAdicionar(item: ItemFila): Promise<void> {
  const db = await abrir();
  await new Promise<void>((resolve, reject) => {
    const t = db.transaction(STORE, "readwrite");
    t.objectStore(STORE).put(item);
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
  db.close();
}

export async function filaListar(): Promise<ItemFila[]> {
  const db = await abrir();
  const itens = await new Promise<ItemFila[]>((resolve, reject) => {
    const t = db.transaction(STORE, "readonly");
    const req = t.objectStore(STORE).getAll();
    req.onsuccess = () => resolve((req.result as ItemFila[]) ?? []);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return itens.sort((a, b) => a.criadoEm - b.criadoEm);
}

export async function filaRemover(clienteId: string): Promise<void> {
  const db = await abrir();
  await new Promise<void>((resolve, reject) => {
    const t = db.transaction(STORE, "readwrite");
    t.objectStore(STORE).delete(clienteId);
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
  db.close();
}

// IndexedDB disponível? (praticamente sempre em browsers/PWA modernos)
export function temFila(): boolean {
  return typeof indexedDB !== "undefined";
}
