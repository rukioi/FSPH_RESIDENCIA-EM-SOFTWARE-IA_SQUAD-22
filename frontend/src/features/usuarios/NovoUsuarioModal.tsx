import { UsuarioFormModal } from './UsuarioForm'
import type { Usuario } from './dados'
import './NovoUsuarioModal.css'

type Props = {
  emailsEmUso: string[]
  aoFechar: () => void
  aoCriar: (dados: Omit<Usuario, 'id' | 'ativo'>) => void
}

export function NovoUsuarioModal({ emailsEmUso, aoFechar, aoCriar }: Props) {
  return (
    <UsuarioFormModal
      titulo="Novo usuário"
      descricao="Cadastre uma conta e defina o perfil de acesso."
      iniciais={{ nome: '', email: '', senha: '', perfil: '' }}
      pedirSenha
      emailsEmUso={emailsEmUso}
      textoSalvar="Salvar"
      aoCancelar={aoFechar}
      aoSalvar={({ nome, email, perfil }) => aoCriar({ nome, email, perfil })}
    />
  )
}
