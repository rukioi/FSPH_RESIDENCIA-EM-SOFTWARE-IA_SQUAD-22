const listeners = new Set<() => void>();
let revision = 0;

/** Invalida leituras derivadas após uma escrita confirmada ou troca de sessão. */
export function notifyDataChanged() {
  revision++;
  listeners.forEach(listener => listener());
}

/** Permite que caches rejeitem resultados iniciados antes de uma alteração. */
export function dataRevision() { return revision; }

/** Inscreve uma consulta ativa sem persistir dados operacionais no navegador. */
export function onDataChanged(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
