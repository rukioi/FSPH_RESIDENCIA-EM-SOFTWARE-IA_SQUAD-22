import { useEffect, useState, type SetStateAction } from 'react';
import { obterToken } from '../services/auth.service';

let preferencia: { token: string | null; aberto: boolean } | undefined;

/** Mantém a preferência desktop em memória entre rotas e layouts, por sessão. */
export function useSidebar() {
  const token = obterToken();
  if (preferencia?.token !== token) preferencia = { token, aberto: true };
  const [menuMovel, setMenuMovel] = useState(() => window.matchMedia('(max-width: 900px)').matches);
  const [menuAberto, atualizar] = useState(() => !window.matchMedia('(max-width: 900px)').matches && (preferencia?.aberto ?? true));
  useEffect(() => {
    const media = window.matchMedia('(max-width: 900px)');
    const ajustar = () => {
      setMenuMovel(media.matches);
      atualizar(!media.matches && (preferencia?.aberto ?? true));
    };
    media.addEventListener('change', ajustar);
    return () => media.removeEventListener('change', ajustar);
  }, []);
  useEffect(() => {
    if (!menuMovel || !menuAberto) return;
    const menu = document.querySelector<HTMLElement>('.menu');
    menu?.querySelector<HTMLElement>('nav button:not(:disabled), nav a')?.focus();
    const fechar = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      atualizar(false);
      document.querySelector<HTMLElement>(`button[aria-controls="${menu?.id}"]`)?.focus();
    };
    window.addEventListener('keydown', fechar);
    return () => window.removeEventListener('keydown', fechar);
  }, [menuMovel, menuAberto]);
  function setMenuAberto(valor: SetStateAction<boolean>) {
    const proximo = typeof valor === 'function' ? valor(menuAberto) : valor;
    if (!menuMovel) preferencia = { token, aberto: proximo };
    atualizar(proximo);
  }
  return { menuAberto, setMenuAberto, menuMovel };
}
