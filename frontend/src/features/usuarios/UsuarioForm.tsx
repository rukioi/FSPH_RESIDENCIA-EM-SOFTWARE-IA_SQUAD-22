// Campos e validação compartilhados pelos modais de Novo e Editar usuário.
import { useEffect, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { Icone } from '../../shared/components/Icone'
import { EMAIL_REGEX } from '../../shared/services/auth.service'
import { PERFIS } from './dados'
import type { Perfil } from './dados'
import './NovoUsuarioModal.css'

export type ValoresUsuario = { nome: string; email: string; senha: string; perfil: Perfil | '' }
type Erros = Partial<Record<keyof ValoresUsuario, string>>

function validar(v: ValoresUsuario, pedirSenha: boolean, emailsEmUso: string[]): Erros {
  const e: Erros = {}
  if (v.nome.trim().length < 3) e.nome = 'Informe o nome completo.'
  if (!v.email.trim()) e.email = 'Informe o e-mail.'
  else if (!EMAIL_REGEX.test(v.email.trim())) e.email = 'E-mail em formato inválido.'
  else if (emailsEmUso.includes(v.email.trim().toLowerCase())) e.email = 'Este e-mail já está cadastrado.'
  if (pedirSenha && v.senha.length < 8) e.senha = 'A senha deve ter pelo menos 8 caracteres.'
  if (!v.perfil) e.perfil = 'Selecione um perfil.'
  return e
}

type Props = {
  titulo: string
  descricao: string
  iniciais: ValoresUsuario
  pedirSenha: boolean
  emailsEmUso: string[]
  textoSalvar: string
  extra?: ReactNode
  aoCancelar: () => void
  aoSalvar: (v: ValoresUsuario & { perfil: Perfil }) => void | Promise<void>
}

/** Valida o formulário e aguarda a confirmação da API, preservando dados em erro. */
export function UsuarioFormModal(props: Props) {
  const { titulo, descricao, iniciais, pedirSenha, emailsEmUso, textoSalvar, aoCancelar, aoSalvar } = props
  const [valores, setValores] = useState(iniciais)
  const [erros, setErros] = useState<Erros>({})
  const [salvando, setSalvando] = useState(false)
  const [falha, setFalha] = useState('')
  const [tentou, setTentou] = useState(false)
  const primeiro = useRef<HTMLInputElement>(null)
  const cancelarRef = useRef(aoCancelar)
  cancelarRef.current = aoCancelar

  // Foco inicial e fechamento por Escape
  useEffect(() => {
    primeiro.current?.focus()
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && cancelarRef.current()
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [])

  function mudar<K extends keyof ValoresUsuario>(campo: K, valor: ValoresUsuario[K]) {
    const novos = { ...valores, [campo]: valor }
    setValores(novos)
    if (tentou) setErros(validar(novos, pedirSenha, emailsEmUso))
  }

  async function enviar(e: FormEvent) {
    e.preventDefault()
    if (salvando) return
    setTentou(true)
    const encontrados = validar(valores, pedirSenha, emailsEmUso)
    setErros(encontrados)
    if (Object.keys(encontrados).length || !valores.perfil) return
    setSalvando(true)
    setFalha('')
    try {
      await aoSalvar({ ...valores, nome: valores.nome.trim(), email: valores.email.trim(), perfil: valores.perfil })
    } catch (erro) {
      setFalha(erro instanceof Error ? erro.message : 'Não foi possível salvar. Tente novamente.')
    } finally { setSalvando(false) }
  }

  const classe = (c: keyof ValoresUsuario) => (erros[c] ? 'campo campo--erro' : 'campo')
  const erro = (c: keyof ValoresUsuario) =>
    erros[c] && (
      <span id={`usr-${c}-erro`} className="campo__erro" role="alert">
        {erros[c]}
      </span>
    )

  return (
    <div className="modal__fundo" onMouseDown={(e) => e.target === e.currentTarget && aoCancelar()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-usuario-titulo">
        <header className="modal__topo">
          <div>
            <h2 id="modal-usuario-titulo">{titulo}</h2>
            <p>{descricao}</p>
          </div>
          <button type="button" className="modal__fechar" aria-label="Fechar" disabled={salvando} onClick={aoCancelar}>
            <Icone nome="fechar" />
          </button>
        </header>

        <form className="modal__form" onSubmit={enviar} noValidate>
          <div className={classe('nome')}>
            <label htmlFor="usr-nome">Nome completo</label>
            <input
              ref={primeiro}
              id="usr-nome"
              value={valores.nome}
              onChange={(e) => mudar('nome', e.target.value)}
              aria-invalid={Boolean(erros.nome)}
              aria-describedby={erros.nome ? 'usr-nome-erro' : undefined}
            />
            {erro('nome')}
          </div>

          <div className={classe('email')}>
            <label htmlFor="usr-email">E-mail</label>
            <input
              id="usr-email"
              type="email"
              value={valores.email}
              onChange={(e) => mudar('email', e.target.value)}
              aria-invalid={Boolean(erros.email)}
              aria-describedby={erros.email ? 'usr-email-erro' : undefined}
            />
            {erro('email')}
          </div>

          {pedirSenha && (
            <div className={classe('senha')}>
              <label htmlFor="usr-senha">Senha</label>
              <input
                id="usr-senha"
                type="password"
                autoComplete="new-password"
                value={valores.senha}
                onChange={(e) => mudar('senha', e.target.value)}
                aria-invalid={Boolean(erros.senha)}
                aria-describedby={erros.senha ? 'usr-senha-erro' : undefined}
              />
              {erro('senha')}
            </div>
          )}

          <div className={classe('perfil')}>
            <label htmlFor="usr-perfil">Perfil</label>
            <select
              id="usr-perfil"
              value={valores.perfil}
              onChange={(e) => mudar('perfil', e.target.value as Perfil)}
              aria-invalid={Boolean(erros.perfil)}
              aria-describedby={erros.perfil ? 'usr-perfil-erro' : undefined}
            >
              <option value="">Selecione…</option>
              {PERFIS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            {erro('perfil')}
          </div>

          {props.extra}
          {salvando && <p role="status">Salvando usuário...</p>}
          {falha && <p role="alert">{falha}</p>}

          <footer className="modal__acoes">
            <button type="button" className="btn btn--secundario" disabled={salvando} onClick={aoCancelar}>
              Cancelar
            </button>
            <button type="submit" disabled={salvando} className="btn btn--primario">
              {textoSalvar}
            </button>
          </footer>
        </form>
      </div>
    </div>
  )
}
