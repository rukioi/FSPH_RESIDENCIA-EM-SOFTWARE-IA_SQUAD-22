import { NovaSolicitacaoSvo } from './NovaSolicitacaoSvo'

/** A prévia reutiliza o formulário visual sem callback de envio. */
export function NovaSolicitacaoPreview({ onVoltar }: { onVoltar: () => void }) {
  return <NovaSolicitacaoSvo onVoltar={onVoltar} />
}
