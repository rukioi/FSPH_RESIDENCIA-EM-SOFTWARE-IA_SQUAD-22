import { useState } from 'react'
import { Icone } from '../../shared/components/Icone'
import type { NomeIcone } from '../../shared/components/Icone'
import './PermissoesPerfil.css'

const PERFIS_CONFIGURAVEIS = ['Gestor de Frota', 'Atendente SVO', 'Motorista', 'Solicitante'] as const
type PerfilConfiguravel = (typeof PERFIS_CONFIGURAVEIS)[number]

type Modulo = { id: string; nome: string; descricao: string; icone: NomeIcone }
const GRUPOS: { titulo: string; modulos: Modulo[] }[] = [
  {
    titulo: 'Operação',
    modulos: [
      { id: 'dashboard', nome: 'Dashboard', descricao: 'Visão geral e indicadores', icone: 'dashboard' },
      { id: 'solicitacoes', nome: 'Solicitações', descricao: 'Pedidos de transporte', icone: 'solicitacoes' },
      { id: 'calendario', nome: 'Calendário', descricao: 'Agenda de viagens', icone: 'calendario' },
      { id: 'svo', nome: 'SVO', descricao: 'Atendimento do serviço SVO', icone: 'svo' },
    ],
  },
  {
    titulo: 'Frota e recursos',
    modulos: [
      { id: 'veiculos', nome: 'Veículos', descricao: 'Cadastro e situação da frota', icone: 'veiculos' },
      { id: 'motoristas', nome: 'Motoristas', descricao: 'Equipe e disponibilidade', icone: 'motoristas' },
      { id: 'documentos', nome: 'Documentos', descricao: 'Licenças e vencimentos', icone: 'documentos' },
      { id: 'abastecimentos', nome: 'Abastecimentos', descricao: 'Registros de combustível', icone: 'abastecimentos' },
    ],
  },
  {
    titulo: 'Gestão e controle',
    modulos: [
      { id: 'relatorios', nome: 'Relatórios', descricao: 'Consultas e exportações', icone: 'relatorios' },
      { id: 'auditoria', nome: 'Auditoria', descricao: 'Logs de acesso e ações', icone: 'auditoria' },
      { id: 'notificacoes', nome: 'Notificações', descricao: 'Avisos do sistema', icone: 'notificacoes' },
      { id: 'configuracoes', nome: 'Configurações', descricao: 'Ajustes gerais', icone: 'configuracoes' },
    ],
  },
]
const TODOS = GRUPOS.flatMap((g) => g.modulos.map((m) => m.id))

type Mapa = Record<PerfilConfiguravel, string[]>
const INICIAL: Mapa = {
  'Gestor de Frota': ['dashboard', 'solicitacoes', 'calendario', 'veiculos', 'motoristas', 'documentos', 'abastecimentos', 'relatorios', 'notificacoes'],
  'Atendente SVO': ['dashboard', 'svo', 'calendario', 'notificacoes'],
  Motorista: ['calendario', 'documentos', 'abastecimentos', 'notificacoes'],
  Solicitante: ['solicitacoes', 'calendario', 'notificacoes'],
}

const mesmo = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x))

export function PermissoesPerfil() {
  const [salvas, setSalvas] = useState<Mapa>(INICIAL)
  const [rascunho, setRascunho] = useState<Mapa>(INICIAL)
  const [perfil, setPerfil] = useState<PerfilConfiguravel>('Gestor de Frota')
  const [sucesso, setSucesso] = useState('')

  const marcados = rascunho[perfil]
  const alterado = !mesmo(marcados, salvas[perfil])
  const perfisAlterados = PERFIS_CONFIGURAVEIS.filter((p) => !mesmo(rascunho[p], salvas[p]))
  const todosMarcados = marcados.length === TODOS.length

  function definir(lista: string[]) {
    setRascunho((r) => ({ ...r, [perfil]: lista }))
    setSucesso('')
  }

  function alternar(id: string) {
    definir(marcados.includes(id) ? marcados.filter((m) => m !== id) : [...marcados, id])
  }

  function salvar() {
    setSalvas((s) => ({ ...s, [perfil]: marcados }))
    setSucesso(`Permissões do perfil ${perfil} salvas.`)
  }

  return (
    <section className="permissoes cartao" aria-labelledby="permissoes-titulo">
      <header className="permissoes__topo">
        <div>
          <h2 id="permissoes-titulo">Permissões de acesso</h2>
          <p>
            Defina quais módulos cada perfil pode visualizar. A configuração vale para todos os usuários do perfil.
          </p>
        </div>
      </header>

      <div className="permissoes__perfis" role="tablist" aria-label="Perfil a configurar">
        {PERFIS_CONFIGURAVEIS.map((p) => (
          <button
            key={p}
            type="button"
            role="tab"
            aria-selected={p === perfil}
            className={p === perfil ? 'permissoes__perfil permissoes__perfil--ativo' : 'permissoes__perfil'}
            onClick={() => {
              setPerfil(p)
              setSucesso('')
            }}
          >
            {p}
            {perfisAlterados.includes(p) && <span className="permissoes__pendente" aria-label="alterações não salvas" />}
          </button>
        ))}
      </div>

      <div className="permissoes__barra">
        <p>
          Configurando: <strong>{perfil}</strong> · {marcados.length} de {TODOS.length} módulos
        </p>
        <button type="button" className="btn btn--secundario" onClick={() => definir(todosMarcados ? [] : TODOS)}>
          {todosMarcados ? 'Desmarcar todos' : 'Selecionar todos'}
        </button>
      </div>

      <div className="permissoes__grupos" role="tabpanel">
        {GRUPOS.map((g) => (
          <fieldset key={g.titulo} className="permissoes__grupo">
            <legend>{g.titulo}</legend>
            {g.modulos.map((m) => {
              const ativo = marcados.includes(m.id)
              return (
                <label key={m.id} className={ativo ? 'permissoes__modulo permissoes__modulo--ativo' : 'permissoes__modulo'}>
                  <input type="checkbox" checked={ativo} onChange={() => alternar(m.id)} />
                  <span className="permissoes__icone">
                    <Icone nome={m.icone} tamanho={18} />
                  </span>
                  <span className="permissoes__texto">
                    <strong>{m.nome}</strong>
                    <small>{m.descricao}</small>
                  </span>
                </label>
              )
            })}
          </fieldset>
        ))}
      </div>

      <footer className="permissoes__rodape">
        <p role="status" aria-live="polite" className={sucesso ? 'permissoes__ok' : 'permissoes__estado'}>
          {sucesso ? (
            <>
              <Icone nome="check" tamanho={16} /> {sucesso}
            </>
          ) : alterado ? (
            'Há alterações não salvas neste perfil.'
          ) : (
            'Nenhuma alteração pendente.'
          )}
        </p>
        <div className="permissoes__acoes">
          {alterado && (
            <button type="button" className="btn btn--secundario" onClick={() => definir(salvas[perfil])}>
              Descartar
            </button>
          )}
          <button type="button" className="btn btn--primario" onClick={salvar} disabled={!alterado}>
            Salvar permissões
          </button>
        </div>
      </footer>
    </section>
  )
}
