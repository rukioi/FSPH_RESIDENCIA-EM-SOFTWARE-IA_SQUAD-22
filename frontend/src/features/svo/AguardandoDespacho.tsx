import "./AguardandoDespacho.css";

export type OrdemColeta = {
  id: string;
  falecido: string;
  endereco: string;
  horario: string;
};

type AguardandoDespachoProps = {
  ordens: OrdemColeta[];
  onPrepararDespacho: (ordem: OrdemColeta) => void;
};

export function AguardandoDespacho({
  ordens,
  onPrepararDespacho,
}: AguardandoDespachoProps) {
  return (
    <section
      className="svo-despacho"
      aria-labelledby="svo-despacho-titulo"
    >
      <header className="svo-despacho__cabecalho">
        <div>
          <h2 id="svo-despacho-titulo">Aguardando despacho</h2>
          <p>{ordens.length} ordens aguardando preparação</p>
        </div>
      </header>

      <div className="svo-despacho__tabela">
        <table>
          <thead>
            <tr>
              <th>Ordem</th>
              <th>Falecido</th>
              <th>Endereço</th>
              <th>Horário</th>
              <th>Ação</th>
            </tr>
          </thead>

          <tbody>
            {ordens.map((ordem) => (
              <tr key={ordem.id}>
                <td data-label="Ordem">
                  <strong>#{ordem.id}</strong>
                </td>

                <td data-label="Falecido">{ordem.falecido}</td>
                <td data-label="Endereço">{ordem.endereco}</td>
                <td data-label="Horário">{ordem.horario}</td>

                <td data-label="Ação">
                  <button
                    type="button"
                    className="svo-despacho__botao"
                    onClick={() => onPrepararDespacho(ordem)}
                  >
                    Preparar despacho
                  </button>
                </td>
              </tr>
            ))}

            {ordens.length === 0 && (
              <tr>
                <td colSpan={5}>
                  Nenhuma ordem aguardando despacho.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
