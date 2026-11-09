import { forwardRef, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import type { ChangeEvent, InputHTMLAttributes, KeyboardEvent, Ref } from 'react'
import { dataIso, exibirData, mascararData } from './datas'
import './DatePicker.css'

type Props = InputHTMLAttributes<HTMLInputElement>
const dias = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const hojeIso = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const primeiraDoMes = (iso: string) => {
  const [ano, mes] = iso.split('-').map(Number)
  const data = new Date(0)
  data.setFullYear(ano, mes - 1, 1)
  data.setHours(12, 0, 0, 0)
  return data
}
const civilIso = (data: Date) => `${String(data.getFullYear()).padStart(4, '0')}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`
function atribuirRef(ref: Ref<HTMLInputElement> | undefined, value: HTMLInputElement | null) {
  if (typeof ref === 'function') ref(value)
  else if (ref) ref.current = value
}

/** Campo de data civil com valor ISO e calendário em português, sem conversão de fuso. */
export const DatePicker = forwardRef<HTMLInputElement, Props>(function DatePicker({
  value, defaultValue, onChange, onBlur, name, min, max, disabled, readOnly, required,
  className, id, type: _type, 'aria-describedby': describedBy, 'aria-invalid': ariaInvalid, ...props
}, ref) {
  void _type
  const inicial = typeof value === 'string' ? value : typeof defaultValue === 'string' ? defaultValue : ''
  const [texto, setTexto] = useState(() => exibirData(inicial))
  const [iso, setIso] = useState(inicial)
  const [tocou, setTocou] = useState(false)
  const [aberto, setAberto] = useState(false)
  const [mes, setMes] = useState(() => primeiraDoMes(dataIso(exibirData(inicial)) || hojeIso()))
  const [anoDigitado, setAnoDigitado] = useState(() => String(primeiraDoMes(dataIso(exibirData(inicial)) || hojeIso()).getFullYear()))
  const [focoDia, setFocoDia] = useState(inicial || hojeIso())
  const campo = useRef<HTMLInputElement>(null)
  const oculto = useRef<HTMLInputElement>(null)
  const ancora = useRef<HTMLSpanElement>(null)
  const painel = useRef<HTMLDivElement>(null)
  const ultimoEmitido = useRef(inicial)
  const erroId = useId()
  const painelId = useId()
  const minimo = typeof min === 'string' ? min : undefined
  const maximo = typeof max === 'string' ? max : undefined
  const digitado = dataIso(texto)
  const fora = !!digitado && (!!minimo && digitado < minimo || !!maximo && digitado > maximo)
  const invalido = !!texto && (!digitado || fora)
  const mensagem = fora ? 'Data fora do intervalo permitido.' : 'Informe uma data válida no formato dd/mm/aaaa.'

  useEffect(() => { setAnoDigitado(String(mes.getFullYear())) }, [mes])

  useEffect(() => {
    if (typeof value !== 'string' || value === ultimoEmitido.current) return
    ultimoEmitido.current = value
    setIso(value)
    setTexto(exibirData(value))
  }, [value])
  useLayoutEffect(() => { campo.current?.setCustomValidity(invalido ? mensagem : '') }, [invalido, mensagem])
  useEffect(() => {
    const input = campo.current
    const form = input?.form
    if (!form || value !== undefined) return
    const resetar = () => {
      const original = typeof defaultValue === 'string' ? defaultValue : ''
      setTexto(exibirData(original)); setIso(original); ultimoEmitido.current = original; setTocou(false)
    }
    form.addEventListener('reset', resetar)
    return () => form.removeEventListener('reset', resetar)
  }, [defaultValue, value])

  useLayoutEffect(() => {
    if (!aberto || !painel.current || !ancora.current) return
    const elemento = painel.current
    if (typeof elemento.showPopover === 'function' && !elemento.matches(':popover-open')) elemento.showPopover()
    const posicionar = () => {
      const rect = ancora.current!.getBoundingClientRect()
      const largura = elemento.offsetWidth
      const altura = elemento.offsetHeight
      const esquerda = Math.max(8, Math.min(rect.left, window.innerWidth - largura - 8))
      const abaixo = rect.bottom + 4
      const topo = abaixo + altura <= window.innerHeight - 8 ? abaixo : Math.max(8, rect.top - altura - 4)
      elemento.style.left = `${esquerda}px`; elemento.style.top = `${topo}px`
    }
    posicionar()
    window.addEventListener('resize', posicionar)
    window.addEventListener('scroll', posicionar, true)
    const foraClique = (event: PointerEvent) => {
      if (!ancora.current?.contains(event.target as Node) && !elemento.contains(event.target as Node)) setAberto(false)
    }
    const foraFoco = (event: FocusEvent) => {
      if (!ancora.current?.contains(event.target as Node) && !elemento.contains(event.target as Node)) setAberto(false)
    }
    const tecla = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setAberto(false); campo.current?.focus() }
    }
    document.addEventListener('pointerdown', foraClique)
    document.addEventListener('focusin', foraFoco)
    document.addEventListener('keydown', tecla, true)
    requestAnimationFrame(() => elemento.querySelector<HTMLButtonElement>('.date-picker__dia[tabindex="0"]')?.focus())
    return () => {
      window.removeEventListener('resize', posicionar); window.removeEventListener('scroll', posicionar, true)
      document.removeEventListener('pointerdown', foraClique); document.removeEventListener('focusin', foraFoco); document.removeEventListener('keydown', tecla, true)
      if (typeof elemento.hidePopover === 'function' && elemento.matches(':popover-open')) elemento.hidePopover()
    }
  }, [aberto])

  function atualizar(proximoTexto: string, event: ChangeEvent<HTMLInputElement> | null) {
    const novaData = dataIso(proximoTexto)
    const valido = novaData && (!minimo || novaData >= minimo) && (!maximo || novaData <= maximo)
    const novoIso = valido ? novaData : ''
    setTexto(proximoTexto); setIso(novoIso); setTocou(true); ultimoEmitido.current = novoIso
    campo.current?.setCustomValidity(proximoTexto && !valido ? 'Informe uma data válida dentro do intervalo permitido.' : '')
    if (oculto.current) oculto.current.value = novoIso
    if (onChange && oculto.current) {
      const alvo = oculto.current
      const original = event ?? ({ type: 'change', target: alvo, currentTarget: alvo } as ChangeEvent<HTMLInputElement>)
      onChange(new Proxy(original, { get(obj, key) { return key === 'target' || key === 'currentTarget' ? alvo : Reflect.get(obj, key) } }))
    }
  }
  function escolher(data: string) {
    atualizar(exibirData(data), null); setAberto(false); campo.current?.focus()
  }
  function mudarMes(delta: number) { setMes(atual => { const novo = new Date(atual); novo.setMonth(novo.getMonth() + delta, 1); return novo.getFullYear() >= 1 && novo.getFullYear() <= 9999 ? novo : atual }) }
  function aplicarAno() {
    const ano = Number(anoDigitado)
    if (!Number.isInteger(ano) || ano < 1 || ano > 9999) { setAnoDigitado(String(mes.getFullYear())); return }
    setMes(atual => { const novo = new Date(atual); novo.setFullYear(ano); return novo })
  }
  function moverDia(event: KeyboardEvent<HTMLButtonElement>, data: Date) {
    const deslocamento: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }
    if (!(event.key in deslocamento)) return
    event.preventDefault()
    const proximo = new Date(data); proximo.setDate(proximo.getDate() + deslocamento[event.key])
    if (proximo.getFullYear() < 1 || proximo.getFullYear() > 9999) return
    setFocoDia(civilIso(proximo))
    setMes(primeiraDoMes(civilIso(proximo)))
    requestAnimationFrame(() => painel.current?.querySelector<HTMLButtonElement>(`[data-data="${civilIso(proximo)}"]`)?.focus())
  }
  const inicio = new Date(mes); inicio.setDate(1 - mes.getDay())
  const datas = Array.from({ length: 42 }, (_, i) => { const dia = new Date(inicio); dia.setDate(inicio.getDate() + i); return dia })
  const podeSelecionar = (data: string) => data >= '0001-01-01' && data <= '9999-12-31' && (!minimo || data >= minimo) && (!maximo || data <= maximo)
  const candidatos = datas.map(civilIso).filter(podeSelecionar)
  const dataFoco = [focoDia, iso, hojeIso(), ...candidatos].find(data => candidatos.includes(data))
  const mesTitulo = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(mes)

  return <span className="date-picker" ref={ancora}>
    <span className="date-picker__campo">
      <input {...props} id={id} ref={elemento => { campo.current = elemento; atribuirRef(ref, elemento) }}
        className={className} type="text" inputMode="numeric" placeholder={props.placeholder ?? 'dd/mm/aaaa'}
        value={texto} disabled={disabled} readOnly={readOnly} required={required} aria-invalid={invalido && tocou || ariaInvalid || undefined}
        aria-describedby={[describedBy, invalido && tocou ? erroId : ''].filter(Boolean).join(' ') || undefined}
        onChange={event => atualizar(mascararData(event.target.value), event)} onBlur={event => { setTocou(true); onBlur?.(event) }} />
      <input ref={oculto} type="hidden" name={name} form={props.form} value={iso} disabled={disabled} />
      <button type="button" className="date-picker__abrir" aria-label="Abrir calendário" aria-expanded={aberto} aria-controls={painelId}
        disabled={disabled || readOnly} onClick={() => { if (!aberto) { setMes(primeiraDoMes(iso || hojeIso())); setFocoDia(iso || hojeIso()) } setAberto(!aberto) }}>
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18"/></svg>
      </button>
    </span>
    {invalido && tocou && <span id={erroId} className="date-picker__erro" role="alert">{mensagem}</span>}
    {aberto && <div id={painelId} ref={painel} popover="manual" className="date-picker__painel" role="dialog" aria-label="Escolher data">
      <div className="date-picker__cabecalho">
        <button type="button" onClick={() => mudarMes(-12)} aria-label="Ano anterior">«</button>
        <button type="button" onClick={() => mudarMes(-1)} aria-label="Mês anterior">‹</button>
        <strong aria-live="polite">{new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(mes)}</strong>
        <button type="button" onClick={() => mudarMes(1)} aria-label="Próximo mês">›</button>
        <button type="button" onClick={() => mudarMes(12)} aria-label="Próximo ano">»</button>
      </div>
      <div className="date-picker__ano"><span id={`${painelId}-ano-label`}>Ano</span>
        <input aria-labelledby={`${painelId}-ano-label`} type="text" inputMode="numeric" value={anoDigitado} maxLength={4}
          onChange={event => setAnoDigitado(event.target.value.replace(/\D/g, ''))} onBlur={aplicarAno}
          onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); aplicarAno() } }} /></div>
      <div className="date-picker__grade" role="grid" aria-label={mesTitulo}>
        <div role="row" className="date-picker__linha">{dias.map(dia => <span role="columnheader" className="date-picker__semana" key={dia}>{dia}</span>)}</div>
        {Array.from({length: 6}, (_, semana) => <div role="row" className="date-picker__linha" key={semana}>{datas.slice(semana * 7, semana * 7 + 7).map(data => { const dataTexto = civilIso(data); const indisponivel = !podeSelecionar(dataTexto)
          return <button type="button" role="gridcell" key={dataTexto} data-data={dataTexto} data-hoje={dataTexto === hojeIso()} tabIndex={dataTexto === dataFoco ? 0 : -1}
            className={`date-picker__dia${data.getMonth() !== mes.getMonth() ? ' date-picker__dia--outro' : ''}`}
            aria-label={new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full' }).format(data)} aria-selected={dataTexto === iso}
            disabled={indisponivel} onFocus={() => setFocoDia(dataTexto)} onKeyDown={event => moverDia(event, data)} onClick={() => escolher(dataTexto)}>{data.getDate()}</button> })}</div>)}
      </div>
      <div className="date-picker__rodape"><button type="button" disabled={!!minimo && hojeIso() < minimo || !!maximo && hojeIso() > maximo} onClick={() => escolher(hojeIso())}>Hoje</button>
        {!required && <button type="button" onClick={() => escolher('')}>Limpar</button>}</div>
    </div>}
  </span>
})
