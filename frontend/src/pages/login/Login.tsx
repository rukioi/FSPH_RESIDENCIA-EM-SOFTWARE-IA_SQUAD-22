import { useState } from 'react'
import type { FormEvent } from 'react'
import { LoginLayout } from '../../layouts/login/LoginLayout'
import { Icone } from '../../shared/components/Icone'
import { navegar } from '../../app/routes/router'
import { EMAIL_REGEX, entrar } from '../../shared/services/auth.service'
import './Login.css'

type Erros = { email?: string; senha?: string }

function validar(email: string, senha: string): Erros {
  const erros: Erros = {}
  if (!email.trim()) erros.email = 'Informe seu e-mail.'
  else if (!EMAIL_REGEX.test(email.trim())) erros.email = 'Digite um e-mail válido, como nome@empresa.com.'
  if (!senha) erros.senha = 'Informe sua senha.'
  return erros
}

export function Login() {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [erros, setErros] = useState<Erros>({})
  const [tentou, setTentou] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [erroLogin, setErroLogin] = useState('')

  async function enviar(e: FormEvent) {
  e.preventDefault()
  setTentou(true)
  setErroLogin('')

  const encontrados = validar(email, senha)
  setErros(encontrados)

  if (Object.keys(encontrados).length) return

  setEnviando(true)

  try {
    const resultado = await entrar({
      email: email.trim(),
      senha,
    })

    navegar(resultado.destino)
  } catch (erro) {
    setErroLogin(
      erro instanceof Error
        ? erro.message
        : 'Não foi possível realizar o login. Tente novamente.',
    )
  } finally {
    setEnviando(false)
  }
}

  function atualizar(campo: 'email' | 'senha', valor: string) {
    if (campo === 'email') setEmail(valor)
    else setSenha(valor)
    if (tentou) setErros(validar(campo === 'email' ? valor : email, campo === 'senha' ? valor : senha))
  }

  return (
    <LoginLayout>
      <div className="login">
        <header className="login__topo">
          <h1>Acesse sua conta</h1>
          <p>Entre com seu e-mail institucional para continuar.</p>
        </header>

        <form className="login__form" onSubmit={enviar} noValidate>
          <div className={erros.email ? 'login__campo login__campo--erro' : 'login__campo'}>
            <label htmlFor="login-email">E-mail</label>
            <div className="login__entrada">
              <Icone nome="email" tamanho={18} />
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                placeholder="nome@empresa.com"
                value={email}
                onChange={(e) => atualizar('email', e.target.value)}
                aria-invalid={Boolean(erros.email)}
                aria-describedby={erros.email ? 'login-email-erro' : undefined}
                className={email ? 'preenchido' : undefined}
              />
            </div>
            {erros.email && (
              <span id="login-email-erro" className="login__erro" role="alert">
                {erros.email}
              </span>
            )}
          </div>

          <div className={erros.senha ? 'login__campo login__campo--erro' : 'login__campo'}>
            <label htmlFor="login-senha">Senha</label>
            <div className="login__entrada">
              <Icone nome="cadeado" tamanho={18} />
              <input
                id="login-senha"
                type={mostrarSenha ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="Sua senha"
                value={senha}
                onChange={(e) => atualizar('senha', e.target.value)}
                aria-invalid={Boolean(erros.senha)}
                aria-describedby={erros.senha ? 'login-senha-erro' : undefined}
                className={senha ? 'preenchido' : undefined}
              />
              <button
                type="button"
                className="login__olho"
                onClick={() => setMostrarSenha(!mostrarSenha)}
                aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
                aria-pressed={mostrarSenha}
              >
                <Icone nome={mostrarSenha ? 'olhoFechado' : 'olho'} tamanho={18} />
              </button>
            </div>
            {erros.senha && (
              <span id="login-senha-erro" className="login__erro" role="alert">
                {erros.senha}
              </span>
            )}
          </div>

          {erroLogin && (
            <p className="login__erro" role="alert">
              {erroLogin}
            </p>
         )}

          <button type="submit" className="btn btn--primario login__enviar" disabled={enviando}>
            {enviando ? (
              <>
                <span className="login__spinner" aria-hidden="true" /> Entrando…
              </>
            ) : (
              'Entrar'
            )}
          </button>
        </form>
      </div>
    </LoginLayout>
  )
}
