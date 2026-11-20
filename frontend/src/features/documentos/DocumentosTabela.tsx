import type { DocumentoGestao } from '../../shared/services/documentos.service'
import {
  dataBr,
  nomeDocumento,
  relacionadoDocumento,
  ROTULO_SITUACAO,
  situacaoDocumento,
} from './documentos.apresentacao'

type Props = {
  documentos: DocumentoGestao[]
  aoVisualizar: (documento: DocumentoGestao) => void
}

export function DocumentosTabela({ documentos, aoVisualizar }: Props) {
  return (
    <div className="docs__tabela-area">
      <table className="docs__tabela">
        <thead>
          <tr>
            <th>Documento</th>
            <th>Relacionado a</th>
            <th>Tipo</th>
            <th>Validade</th>
            <th>Situação</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          {documentos.map((documento) => {
            const situacao = situacaoDocumento(documento)
            const nome = nomeDocumento(documento)
            return (
              <tr key={`${documento.tipo}-${documento.id}`}>
                <td data-label="Documento">
                  <strong>{nome}</strong>
                </td>
                <td data-label="Relacionado a">
                  {relacionadoDocumento(documento)}
                </td>
                <td data-label="Tipo" className="docs__suave">
                  {documento.tipo === 'CNH_MOTORISTA'
                    ? 'Motorista'
                    : 'Veículo'}
                </td>
                <td data-label="Validade">{dataBr(documento.dataValidade)}</td>
                <td data-label="Situação">
                  <span
                    className={`docs__selo docs__selo--${situacao.toLowerCase()}`}
                  >
                    {ROTULO_SITUACAO[situacao]}
                  </span>
                </td>
                <td data-label="Ações">
                  <button
                    type="button"
                    className="docs__botao"
                    aria-label={`Visualizar ${nome}`}
                    onClick={() => aoVisualizar(documento)}
                  >
                    Visualizar
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
