import { UsuarioFormModal } from './UsuarioForm'
import type { Usuario } from './dados'
import './EditarUsuarioModal.css'

type Props = {
  usuario: Usuario
  emailsEmUso: string[]
  aoFechar: () => void
  aoSalvar: (u: Usuario) => void | Promise<void>
}

/** Reutiliza o formulário de usuários e aguarda o salvamento da edição. */
export function EditarUsuarioModal({ usuario, emailsEmUso, aoFechar, aoSalvar }: Props) {
  return (
    <UsuarioFormModal
      titulo="Editar usuário"
      descricao="Atualize os dados e o perfil desta conta."
      iniciais={{ nome: usuario.nome, email: usuario.email, senha: '', perfil: usuario.perfil }}
      pedirSenha={false}
      emailsEmUso={emailsEmUso.filter((e) => e !== usuario.email.toLowerCase())}
      textoSalvar="Salvar alterações"
      extra={
        <p className="editar-usuario__situacao">
          Situação atual:{' '}
          <span className={usuario.ativo ? 'badge badge--verde' : 'badge badge--vermelho'}>
            {usuario.ativo ? 'Ativo' : 'Inativo'}
          </span>
        </p>
      }
      aoCancelar={aoFechar}
      aoSalvar={({ nome, email, perfil }) => aoSalvar({ ...usuario, nome, email, perfil })}
    />
  )
}
