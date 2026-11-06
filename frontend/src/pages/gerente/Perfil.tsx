import type { UsuarioSessao } from '../../shared/services/auth.service'
import './Perfil.css'
import '../../shared/styles/cartao-identidade.css'

/** Exibe a identidade atual confirmada pela API de sessão. */
export function Perfil({ usuario }: { usuario: UsuarioSessao }) {
  const nome = usuario.nome || 'Usuário'
  const iniciais = nome.trim().split(/\s+/).slice(0, 2).map(parte => parte[0]).join('').toUpperCase()
  return (
    <section className="perfil-gestor" aria-labelledby="perfil-titulo">
      <div className="perfil-gestor__titulo"><h2 id="perfil-titulo">Meu perfil</h2><p>Informações da sua conta</p></div>
      <div className="cartao-identidade">
        <div className="cartao-identidade__principal">
          <span className="cartao-identidade__avatar" aria-hidden="true">{iniciais}</span>
          <h3>{nome}</h3>
          <p className="perfil-gestor__cargo">{usuario.perfil === 'ADM' ? 'Administrador' : 'Gestor de Frota'}</p>
        </div>
        <div className="cartao-identidade__conteudo">
          <dl className="perfil-gestor__dados">
            <div><dt>Nome</dt><dd>{usuario.nome || 'Não informado'}</dd></div>
            <div><dt>E-mail</dt><dd>{usuario.email || 'Não informado'}</dd></div>
            <div><dt>Perfil de acesso</dt><dd>{usuario.perfil === 'ADM' ? 'Administrador' : 'Gestor de Frota'}</dd></div>
          </dl>
        </div>
      </div>
    </section>
  )
}
