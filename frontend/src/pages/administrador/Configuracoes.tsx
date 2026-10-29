import { UsuariosTabela } from '../../features/usuarios/UsuariosTabela'
import { PermissoesPerfil } from '../../features/usuarios/PermissoesPerfil'
import './Configuracoes.css'

export function Configuracoes() {
  return (
    <div className="configuracoes">
      <div className="pagina__topo">
        <div>
          <h1 className="pagina__titulo">Configurações</h1>
          <p className="pagina__descricao">Gerencie as contas de usuários e o acesso de cada perfil aos módulos.</p>
        </div>
      </div>
      <UsuariosTabela />
      <PermissoesPerfil />
    </div>
  )
}
