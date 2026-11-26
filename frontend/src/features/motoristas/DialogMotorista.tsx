import { useEffect, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

/** Usa as variantes de botão e os tokens já existentes no tema. */
export function BotaoMotorista({ variante = 'secundario', className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: 'primario' | 'secundario' | 'perigo' }) {
  return <button type="button" {...props} className={`btn btn--${variante} md-botao ${className}`} />;
}

/** showModal oferece foco contido e torna o restante da página inerte. */
export function DialogMotorista({ rotulo, descricao, ocupado = false, onFechar, children }: {
  rotulo: string; descricao?: string; ocupado?: boolean; onFechar: () => void; children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const anterior = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.showModal();
    return () => {
      dialog.close();
      if (anterior?.isConnected) anterior.focus();
    };
  }, []);
  return <dialog ref={ref} className="md-dialog-host" aria-labelledby={rotulo} aria-describedby={descricao} aria-busy={ocupado}
    onCancel={evento => { evento.preventDefault(); if (!ocupado) onFechar(); }}>
    {children}
  </dialog>;
}
