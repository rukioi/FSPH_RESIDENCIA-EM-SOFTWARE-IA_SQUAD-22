import { useMemo, useState } from 'react'
import { Icone } from '../../shared/components/Icone'
import { Paginacao, usePaginacao } from '../../shared/components/Paginacao'
import { PERFIS, corPerfil, usuariosIniciais } from './dados'
import type { Perfil, Usuario } from './dados'
import { NovoUsuarioModal } from './NovoUsuarioModal'
import { EditarUsuarioModal } from './EditarUsuarioModal'
import './UsuariosTabela.css'

const POR_PAGINA = 6

export function UsuariosTabela() {
  const [usuarios, setUsuarios] = useState<Usuario[]>(usuariosIniciais)
  const [busca, setBusca] = useState('')
  const [perfil, setPerfil] = useState<Perfil | ''>('')
  const [novoAberto, setNovoAberto] = useState(false)
  const [editando, setEditando] = useState<Usuario | null>(null)
  const [desativando, setDesativando] = useState<Usuario | null>(null)
  const [aviso, setAviso] = useState('')

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return usuarios.filter(
      (u) =>
        (!perfil || u.perfil === perfil) &&
        (!termo || u.nome.toLowerCase().includes(termo) || u.email.toLowerCase().includes(termo)),
    )
  }, [usuarios, busca, perfil])

  const pag = usePaginacao(filtrados, POR_PAGINA)
  const emails = usuarios.map((u) => u.email.toLowerCase())

  function avisar(texto: string) {
    setAviso(texto)
    window.setTimeout(() => setAviso(''), 3500)
  }

  function alternar(u: Usuario) {
    if (u.ativo) return setDesativando(u)
    setUsuarios((l) => l.map((x) => (x.id === u.id ? { ...x, ativo: true } : x)))
    avisar(`Conta de ${u.nome} ativada.`)
  }

  function confirmarDesativar() {
    if (!desativando) return
    setUsuarios((l) => l.map((x) => (x.id === desativando.id ? { ...x, ativo: false } : x)))
    avisar(`Conta de ${desativando.nome} desativada.`)
    setDesativando(null)
  }

  return (
    <section className="usuarios cartao" aria-labelledby="usuarios-titulo">
      <header className="usuarios__topo">
        <div>
          <h2 id="usuarios-titulo">Gestão de usuários</h2>
          <p>Cadastre, edite e controle a situação das contas do sistema.</p>
        </div>
        <button type="button" className="btn btn--primario" onClick={() => setNovoAberto(true)}>
          <Icone nome="mais" tamanho={18} /> Novo usuário
        </button>
      </header>

      <div className="usuarios__filtros">
        <label className="usuarios__busca">
          <span className="sr-only">Buscar por nome ou e-mail</span>
          <Icone nome="busca" tamanho={18} />
          <input
            type="search"
            placeholder="Buscar por nome ou e-mail"
            value={busca}
            onChange={(e) => {
              setBusca(e.target.value)
              pag.setPagina(1)
            }}
          />
        </label>
        <label className="usuarios__filtro">
          <span className="sr-only">Filtrar por perfil</span>
          <select
            value={perfil}
            onChange={(e) => {
              setPerfil(e.target.value as Perfil | '')
              pag.setPagina(1)
            }}
          >
            <option value="">Todos os perfis</option>
            {PERFIS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
      </div>

      <p className="usuarios__aviso" role="status" aria-live="polite">
        {aviso}
      </p>

      <div className="usuarios__rolagem">
        <table className="usuarios__tabela">
          <thead>
            <tr>
              <th scope="col">Nome</th>
              <th scope="col">E-mail</th>
              <th scope="col">Perfil</th>
              <th scope="col">Situação</th>
              <th scope="col" className="usuarios__col-acoes">
                Ações
              </th>
            </tr>
          </thead>
          <tbody>
            {pag.visiveis.map((u) => (
              <tr key={u.id} className={u.ativo ? undefined : 'usuarios__linha--inativa'}>
                <td>
                  <span className="usuarios__nome">
                    <span className="usuarios__avatar" aria-hidden="true">
                      {u.nome
                        .split(' ')
                        .map((p) => p[0])
                        .slice(0, 2)
                        .join('')}
                    </span>
                    {u.nome}
                  </span>
                </td>
                <td className="usuarios__email">{u.email}</td>
                <td>
                  <span className={`badge ${corPerfil[u.perfil]}`}>{u.perfil}</span>
                </td>
                <td>
                  <span className={u.ativo ? 'badge badge--verde' : 'badge badge--vermelho'}>
                    <span className="usuarios__ponto" aria-hidden="true" />
                    {u.ativo ? 'Ativo' : 'Inativo'}
                  </span>
                </td>
                <td className="usuarios__col-acoes">
                  <div className="usuarios__acoes">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={u.ativo}
                      aria-label={`${u.ativo ? 'Desativar' : 'Ativar'} conta de ${u.nome}`}
                      className={u.ativo ? 'interruptor interruptor--ligado' : 'interruptor'}
                      onClick={() => alternar(u)}
                    >
                      <span />
                    </button>
                    <button
                      type="button"
                      className="usuarios__editar"
                      aria-label={`Editar ${u.nome}`}
                      onClick={() => setEditando(u)}
                    >
                      <Icone nome="editar" tamanho={18} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!pag.total && (
          <div className="vazio">
            <strong>Nenhum usuário encontrado</strong>
            Ajuste a busca ou o filtro de perfil.
          </div>
        )}
      </div>

      <Paginacao {...pag} rotulo="usuários" aoMudar={pag.setPagina} />

      {novoAberto && (
        <NovoUsuarioModal
          emailsEmUso={emails}
          aoFechar={() => setNovoAberto(false)}
          aoCriar={(dados) => {
            setUsuarios((l) => [{ ...dados, id: Math.max(0, ...l.map((u) => u.id)) + 1, ativo: true }, ...l])
            setBusca('')
            setPerfil('')
            pag.setPagina(1)
            setNovoAberto(false)
            avisar(`Usuário ${dados.nome} cadastrado.`)
          }}
        />
      )}

      {editando && (
        <EditarUsuarioModal
          usuario={editando}
          emailsEmUso={emails}
          aoFechar={() => setEditando(null)}
          aoSalvar={(u) => {
            setUsuarios((l) => l.map((x) => (x.id === u.id ? u : x)))
            setEditando(null)
            avisar(`Dados de ${u.nome} atualizados.`)
          }}
        />
      )}

      {desativando && (
        <div className="modal__fundo" onMouseDown={(e) => e.target === e.currentTarget && setDesativando(null)}>
          <div
            className="modal usuarios__confirmar"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="conf-titulo"
            aria-describedby="conf-texto"
            onKeyDown={(e) => e.key === 'Escape' && setDesativando(null)}
          >
            <h2 id="conf-titulo">Desativar conta?</h2>
            <p id="conf-texto">
              <strong>{desativando.nome}</strong> perderá o acesso ao sistema até a conta ser reativada.
            </p>
            <div className="modal__acoes">
              <button type="button" className="btn btn--secundario" autoFocus onClick={() => setDesativando(null)}>
                Cancelar
              </button>
              <button type="button" className="btn btn--perigo" onClick={confirmarDesativar}>
                Desativar
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
