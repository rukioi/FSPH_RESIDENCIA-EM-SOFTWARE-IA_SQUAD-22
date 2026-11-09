import { useRef, useState, type FormEvent } from 'react';
import { createRoot } from 'react-dom/client';
import { DatePicker } from '../../frontend/src/shared/components/DatePicker';
import { Select } from '../../frontend/src/shared/components/Select';

function Fixture() {
  const [result, setResult] = useState('');
  const [controlled, setControlled] = useState('b');
  const [controlledDate, setControlledDate] = useState('2024-02-15');
  const [disabled, setDisabled] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResult(JSON.stringify(Object.fromEntries(new FormData(event.currentTarget))));
  }
  return <main style={{ maxWidth: 620, margin: '20px auto', padding: 16, fontFamily: 'sans-serif' }}>
    <h1>Controles de formulário</h1>
    <form onSubmit={submit} onReset={() => { setControlled('b'); setControlledDate('2024-02-15'); }}>
      <div style={{ margin: "1em 0" }}><label htmlFor="data">Data</label><DatePicker id="data" name="data" required min="2024-02-01" max="2024-03-31" /></div>
      <div style={{ margin: "1em 0" }}><label htmlFor="escolha">Escolha</label><Select id="escolha" name="escolha" required defaultValue=""><option value="" disabled>Selecione</option><option value="a">Alfa</option><option value="b">Brisa</option><option value="c" disabled>Desativada</option><option value="d">Delta</option></Select></div>
      <div style={{ margin: "1em 0" }}><label htmlFor="controlado">Controlado</label><Select id="controlado" name="controlado" value={controlled} onChange={event => setControlled(event.currentTarget.value)}><option value="a">Alfa</option><option value="b">Brisa</option><option value="d">Delta</option></Select></div>
      <div><label>Escolha implícita<Select name="implicita" defaultValue="a"><option value="a">Alfa</option><option value="b">Brisa</option></Select></label></div>
      <div><label htmlFor="data-controlada">Data controlada</label><DatePicker id="data-controlada" name="data-controlada" value={controlledDate} onChange={event => setControlledDate(event.currentTarget.value)} /></div>
      <fieldset disabled={disabled}><label htmlFor="bloqueio">Campo bloqueável</label><Select id="bloqueio" name="bloqueio" defaultValue="a"><option value="a">Alfa</option><option value="b">Brisa</option></Select></fieldset>
      <button type="button" onClick={() => setDisabled(value => !value)}>Alternar bloqueio</button>
      <button type="submit">Enviar</button><button type="reset">Restaurar</button>
    </form>
    <output aria-label="Resultado">{result}</output>
    <p><button type="button" onClick={() => dialog.current?.showModal()}>Abrir modal</button></p>
    <dialog ref={dialog}><h2>Modal de teste</h2><label htmlFor="data-modal">Data no modal</label><DatePicker id="data-modal" name="data-modal" /><label htmlFor="select-modal">Escolha no modal</label><Select id="select-modal" defaultValue="a"><option value="a">Alfa</option><option value="b">Brisa</option></Select><button type="button" onClick={() => dialog.current?.close()}>Fechar modal</button></dialog>
  </main>;
}

createRoot(document.getElementById('root')!).render(<Fixture />);

