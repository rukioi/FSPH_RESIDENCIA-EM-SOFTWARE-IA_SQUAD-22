import type { OrdemColeta } from "./AguardandoDespacho";
import "./ProntasParaIniciar.css";

export type OrdemPronta = OrdemColeta & {
  veiculo: string;
  motorista: string;
};

type ProntasParaIniciarProps = {
  ordens: OrdemPronta[];
};

export function ProntasParaIniciar({
  ordens,
}: ProntasParaIniciarProps) {
  return (
    <section className="svo-prontas">
      <header className="svo-prontas__cabecalho">
        <div>
          <h2>Prontas para iniciar</h2>
          <p>{ordens.length} ordens prontas</p>
        </div>
      </header>

      <div className="svo-prontas__lista">
        {ordens.map((ordem) => (
          <article key={ordem.id} className="svo-prontas__item">
            <div>
              <strong>#{ordem.id}</strong>
              <p>{ordem.falecido}</p>
            </div>

            <div>
              <span>{ordem.veiculo}</span>
              <span>{ordem.motorista}</span>
            </div>
          </article>
        ))}

        {ordens.length === 0 && (
          <p className="svo-prontas__vazio">
            Nenhuma ordem pronta para iniciar.
          </p>
        )}
      </div>
    </section>
  );
}
