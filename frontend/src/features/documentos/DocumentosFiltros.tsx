import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import type { FiltrosDocumentos } from '../../shared/services/documentos.service'

type Props = {
  valores: FiltrosDocumentos
  carregando: boolean
  aoAplicar: (filtros: FiltrosDocumentos) => void
  aoLimpar: () => void
}

export function DocumentosFiltros({
  valores,
  carregando,
  aoAplicar,
  aoLimpar,
}: Props) {
  const [rascunho, setRascunho] = useState<FiltrosDocumentos>(valores)
  const [erroPeriodo, setErroPeriodo] = useState<string | null>(null)

  useEffect(() => {
    setRascunho(valores)
    setErroPeriodo(null)
  }, [valores])

  function atualizar<K extends keyof FiltrosDocumentos>(
    chave: K,
    valor: FiltrosDocumentos[K],
  ) {
    setRascunho((atual) => ({ ...atual, [chave]: valor }))
  }

  function aplicar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (rascunho.inicio && rascunho.fim && rascunho.inicio > rascunho.fim) {
      setErroPeriodo('A data inicial deve ser anterior ou igual à data final.')
      return
    }

    setErroPeriodo(null)
    aoAplicar({
      ...rascunho,
      veiculoId: rascunho.veiculoId?.trim() || undefined,
      motoristaId: rascunho.motoristaId?.trim() || undefined,
    })
  }

  function limpar() {
    setRascunho({})
    setErroPeriodo(null)
    aoLimpar()
  }

  return (
    <details className="docs__filtros">
      <summary>Filtros de documentos</summary>
      <form className="docs__filtros-form" onSubmit={aplicar}>
        <label>
          Tipo
          <select
            value={rascunho.tipo ?? ''}
            onChange={(evento) => {
              const tipo = evento.target.value as FiltrosDocumentos['tipo']
              setRascunho((atual) => ({
                ...atual,
                tipo: tipo || undefined,
                veiculoId:
                  tipo === 'CNH_MOTORISTA' ? undefined : atual.veiculoId,
                motoristaId:
                  tipo === 'DOCUMENTO_VEICULO' ? undefined : atual.motoristaId,
              }))
            }}
          >
            <option value="">Todos</option>
            <option value="DOCUMENTO_VEICULO">Documentos de veículos</option>
            <option value="CNH_MOTORISTA">CNHs de motoristas</option>
          </select>
        </label>

        <label>
          Situação
          <select
            value={rascunho.situacao ?? ''}
            onChange={(evento) =>
              atualizar(
                'situacao',
                (evento.target.value ||
                  undefined) as FiltrosDocumentos['situacao'],
              )
            }
          >
            <option value="">Todas</option>
            <option value="A_VENCER">A vencer</option>
            <option value="HOJE">Vence hoje</option>
            <option value="VENCIDO">Vencido</option>
          </select>
        </label>

        <label>
          ID do veículo
          <input
            type="text"
            inputMode="numeric"
            pattern="[1-9][0-9]*"
            title="Informe um número inteiro positivo"
            placeholder="Ex.: 12"
            value={rascunho.veiculoId ?? ''}
            disabled={rascunho.tipo === 'CNH_MOTORISTA'}
            onChange={(evento) => atualizar('veiculoId', evento.target.value)}
          />
        </label>

        <label>
          ID do motorista
          <input
            type="text"
            inputMode="numeric"
            pattern="[1-9][0-9]*"
            title="Informe um número inteiro positivo"
            placeholder="Ex.: 8"
            value={rascunho.motoristaId ?? ''}
            disabled={rascunho.tipo === 'DOCUMENTO_VEICULO'}
            onChange={(evento) => atualizar('motoristaId', evento.target.value)}
          />
        </label>

        <label>
          Validade inicial
          <input
            type="date"
            value={rascunho.inicio ?? ''}
            onChange={(evento) =>
              atualizar('inicio', evento.target.value || undefined)
            }
          />
        </label>

        <label>
          Validade final
          <input
            type="date"
            value={rascunho.fim ?? ''}
            onChange={(evento) =>
              atualizar('fim', evento.target.value || undefined)
            }
          />
        </label>

        {erroPeriodo && (
          <p className="docs__filtros-erro" role="alert">
            {erroPeriodo}
          </p>
        )}

        <div className="docs__filtros-acoes">
          <button
            type="button"
            className="docs__botao"
            onClick={limpar}
            disabled={carregando}
          >
            Limpar
          </button>
          <button
            type="submit"
            className="docs__botao docs__botao--primario"
            disabled={carregando}
          >
            Aplicar filtros
          </button>
        </div>
      </form>
    </details>
  )
}
