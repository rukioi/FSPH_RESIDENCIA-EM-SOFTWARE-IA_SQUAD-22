import {
  Children,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { KeyboardEvent, ReactNode, SelectHTMLAttributes } from "react";
import "./Select.css";

type Opcao = { valor: string; rotulo: string; desabilitada: boolean };
type Props = SelectHTMLAttributes<HTMLSelectElement>;

function texto(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(texto).join("");
  return isValidElement<{ children?: ReactNode }>(node)
    ? texto(node.props.children)
    : "";
}

function opcoes(children: ReactNode, grupoDesabilitado = false): Opcao[] {
  return Children.toArray(children).flatMap((child) => {
    if (
      !isValidElement<{
        children?: ReactNode;
        value?: string | number | readonly string[];
        disabled?: boolean;
      }>(child)
    )
      return [];
    if (child.type === "optgroup")
      return opcoes(
        child.props.children,
        grupoDesabilitado || !!child.props.disabled,
      );
    if (child.type !== "option") return [];
    const rotulo = texto(child.props.children);
    return [
      {
        valor: String(child.props.value ?? rotulo),
        rotulo,
        desabilitada: grupoDesabilitado || !!child.props.disabled,
      },
    ];
  });
}

/** Select de escolha única com formulário nativo e lista acessível no top layer. */
export function Select({
  children,
  className,
  id,
  value,
  defaultValue,
  onChange,
  onInvalid,
  disabled,
  required,
  name,
  tabIndex,
  style,
  ...props
}: Props) {
  const gerado = useId().replace(/:/g, "");
  const triggerId = id ?? `select-${gerado}`;
  const listaId = `${triggerId}-lista`;
  const nativo = useRef<HTMLSelectElement>(null);
  const botao = useRef<HTMLButtonElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const digitado = useRef("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [aberto, setAberto] = useState(false);
  const [bloqueado, setBloqueado] = useState(!!disabled);
  const [invalido, setInvalido] = useState(false);
  const [rotuloImplicito, setRotuloImplicito] = useState("");
  const [selecionado, setSelecionado] = useState(
    String(value ?? defaultValue ?? ""),
  );
  const [ativo, setAtivo] = useState(0);
  const itens = opcoes(children);
  const selecionadoReal = value === undefined ? selecionado : String(value);
  const indiceSelecionado = Math.max(
    0,
    itens.findIndex((item) => item.valor === selecionadoReal),
  );

  useLayoutEffect(() => {
    const label = nativo.current?.closest("label");
    if (label && !label.htmlFor) {
      const copia = label.cloneNode(true) as HTMLLabelElement;
      copia
        .querySelectorAll("select, button, [popover]")
        .forEach((elemento) => elemento.remove());
      setRotuloImplicito(copia.textContent?.trim() ?? "");
    }
  }, []);
  useLayoutEffect(() => {
    if (nativo.current && value === undefined)
      setSelecionado(nativo.current.value);
  }, [children, value]);
  useEffect(() => {
    const select = nativo.current;
    if (!select) return;
    const atualizar = () => setBloqueado(select.matches(":disabled"));
    atualizar();
    const observer = new MutationObserver(atualizar);
    let elemento: HTMLElement | null = select;
    while (elemento) {
      if (elemento.tagName === "FIELDSET" || elemento === select)
        observer.observe(elemento, {
          attributes: true,
          attributeFilter: ["disabled"],
        });
      elemento = elemento.parentElement;
    }
    const form = select.form;
    const resetar = () =>
      requestAnimationFrame(() => setSelecionado(select.value));
    form?.addEventListener("reset", resetar);
    return () => {
      observer.disconnect();
      form?.removeEventListener("reset", resetar);
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const posicionar = useCallback(() => {
    const anchor = botao.current;
    const menu = popup.current;
    if (!anchor || !menu) return;
    const rect = anchor.getBoundingClientRect();
    const largura = Math.min(Math.max(rect.width, 180), window.innerWidth - 16);
    const altura = Math.min(menu.scrollHeight, 240);
    const abaixo = window.innerHeight - rect.bottom - 8;
    const topo =
      abaixo >= Math.min(altura, 120) || abaixo >= rect.top
        ? rect.bottom + 4
        : Math.max(8, rect.top - altura - 4);
    Object.assign(menu.style, {
      left: `${Math.max(8, Math.min(rect.left, window.innerWidth - largura - 8))}px`,
      top: `${topo}px`,
      width: `${largura}px`,
      maxHeight: `${Math.max(40, Math.min(240, topo < rect.top ? rect.top - 12 : window.innerHeight - topo - 8))}px`,
    });
  }, []);
  const fechar = useCallback((focar = false) => {
    if (popup.current?.matches(":popover-open")) popup.current.hidePopover();
    setAberto(false);
    if (focar) botao.current?.focus();
  }, []);
  const abrir = () => {
    if (bloqueado) return;
    setAtivo(indiceSelecionado);
    popup.current?.showPopover();
    setAberto(true);
    requestAnimationFrame(posicionar);
  };
  useEffect(() => {
    if (!aberto) return;
    const fora = (event: PointerEvent) => {
      if (
        !botao.current?.contains(event.target as Node) &&
        !popup.current?.contains(event.target as Node)
      )
        fechar();
    };
    const foco = (event: FocusEvent) => {
      if (
        !botao.current?.contains(event.target as Node) &&
        !popup.current?.contains(event.target as Node)
      )
        fechar();
    };
    document.addEventListener("pointerdown", fora);
    document.addEventListener("focusin", foco);
    window.addEventListener("resize", posicionar);
    window.addEventListener("scroll", posicionar, true);
    return () => {
      document.removeEventListener("pointerdown", fora);
      document.removeEventListener("focusin", foco);
      window.removeEventListener("resize", posicionar);
      window.removeEventListener("scroll", posicionar, true);
    };
  }, [aberto, fechar, posicionar]);
  useEffect(() => {
    if (bloqueado && aberto) fechar();
  }, [bloqueado, aberto, fechar]);
  useEffect(() => {
    if (aberto)
      popup.current
        ?.querySelector<HTMLElement>(`[data-indice="${ativo}"]`)
        ?.scrollIntoView({ block: "nearest" });
  }, [ativo, aberto]);

  function escolher(indice: number) {
    const item = itens[indice];
    const select = nativo.current;
    if (!item || item.desabilitada || !select) return;
    select.value = item.valor;
    if (select.validity.valid) setInvalido(false);
    setSelecionado(item.valor);
    select.dispatchEvent(new Event("change", { bubbles: true }));
    fechar(true);
  }
  function mover(inicio: number, passo: number) {
    for (let i = inicio; i >= 0 && i < itens.length; i += passo)
      if (!itens[i].desabilitada) {
        setAtivo(i);
        return;
      }
  }
  function teclado(event: KeyboardEvent<HTMLButtonElement>) {
    const key = event.key;
    if (key === "Tab") {
      fechar();
      return;
    }
    if (key === "Escape" && aberto) {
      event.preventDefault();
      event.stopPropagation();
      fechar(true);
      return;
    }
    if (
      key === "ArrowDown" ||
      key === "ArrowUp" ||
      key === "Home" ||
      key === "End"
    ) {
      event.preventDefault();
      if (!aberto) abrir();
      if (key === "Home") mover(0, 1);
      else if (key === "End") mover(itens.length - 1, -1);
      else
        mover(
          Math.max(
            0,
            Math.min(
              itens.length - 1,
              (aberto ? ativo : indiceSelecionado) +
                (key === "ArrowDown" ? 1 : -1),
            ),
          ),
          key === "ArrowDown" ? 1 : -1,
        );
      return;
    }
    if (key === "Enter" || key === " ") {
      event.preventDefault();
      if (aberto) escolher(ativo);
      else abrir();
      return;
    }
    if (key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      digitado.current += key.toLocaleLowerCase("pt-BR");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        digitado.current = "";
      }, 700);
      const indice = itens.findIndex(
        (item) =>
          !item.desabilitada &&
          item.rotulo.toLocaleLowerCase("pt-BR").startsWith(digitado.current),
      );
      if (indice >= 0) {
        if (!aberto) abrir();
        setAtivo(indice);
      }
    }
  }
  const {
    "aria-label": ariaLabel,
    "aria-labelledby": labelledby,
    "aria-describedby": describedby,
    "aria-invalid": ariaInvalid,
    ...nativoProps
  } = props;
  return (
    <>
      <button
        ref={botao}
        id={triggerId}
        type="button"
        role="combobox"
        className={`select-personalizado ${className ?? ""}`}
        style={style}
        tabIndex={tabIndex}
        disabled={bloqueado}
        aria-label={
          ariaLabel ?? (labelledby ? undefined : rotuloImplicito || undefined)
        }
        aria-labelledby={labelledby}
        aria-describedby={
          [describedby, invalido ? `${triggerId}-erro` : undefined]
            .filter(Boolean)
            .join(" ") || undefined
        }
        aria-invalid={ariaInvalid ?? (invalido || undefined)}
        aria-required={required}
        aria-expanded={aberto}
        aria-controls={listaId}
        aria-activedescendant={aberto ? `${listaId}-${ativo}` : undefined}
        onClick={() => (aberto ? fechar() : abrir())}
        onKeyDown={teclado}
      >
        <span>{itens[indiceSelecionado]?.rotulo ?? ""}</span>
        <span className="select-personalizado__seta" aria-hidden="true">
          ⌄
        </span>
      </button>
      <select
        {...nativoProps}
        ref={nativo}
        id={`${triggerId}-nativo`}
        name={name}
        disabled={disabled}
        required={required}
        value={value}
        defaultValue={defaultValue}
        className="select-nativo"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => {
          setSelecionado(event.currentTarget.value);
          onChange?.(event);
        }}
        onInvalid={(event) => {
          event.preventDefault();
          setInvalido(true);
          botao.current?.focus();
          onInvalid?.(event);
        }}
      >
        {children}
      </select>
      <div
        ref={popup}
        id={listaId}
        popover="manual"
        role="listbox"
        className="select-popup"
        aria-label="Opções"
      >
        {itens.map((item, indice) => (
          <div
            key={`${item.valor}-${indice}`}
            id={`${listaId}-${indice}`}
            data-indice={indice}
            data-value={item.valor}
            role="option"
            aria-selected={indice === indiceSelecionado}
            aria-disabled={item.desabilitada || undefined}
            className={`select-popup__opcao${indice === ativo ? " select-popup__opcao--ativa" : ""}`}
            onMouseMove={() => {
              if (!item.desabilitada) setAtivo(indice);
            }}
            onPointerDown={(event) => event.preventDefault()}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              escolher(indice);
            }}
          >
            <span>{item.rotulo}</span>
            {indice === indiceSelecionado && <span aria-hidden="true">✓</span>}
          </div>
        ))}
      </div>
      {invalido && (
        <span id={`${triggerId}-erro`} className="select-erro" role="alert">
          Selecione uma opção.
        </span>
      )}
    </>
  );
}
