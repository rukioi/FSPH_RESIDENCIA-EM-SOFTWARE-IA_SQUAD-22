import { useId, useState, type KeyboardEvent } from 'react';
import type { VeiculoDto } from '../../shared/services/veiculos.service';
import { vinculo } from './manutencoes.form';

const situacoes = {DISPONIVEL:'Disponível', EM_VIAGEM:'Em viagem', EM_MANUTENCAO:'Em manutenção', INDISPONIVEL:'Indisponível'};

function rotulo(v: VeiculoDto) {
  return [v.placa, v.modelo, vinculo[v.vinculo], v.status ? situacoes[v.status] : 'Status não informado'].join(' · ');
}

function normalizar(texto: string) {
  return texto.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/\p{M}/gu, '').trim();
}

type Props = {
  veiculos: VeiculoDto[];
  valor: string;
  desabilitado: boolean;
  aoSelecionar: (id: string) => void;
  'aria-invalid': boolean;
  'aria-describedby'?: string;
};

export function SeletorVeiculoManutencao({veiculos, valor, desabilitado, aoSelecionar, ...aria}: Props) {
  const lista = useId();
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState('');
  const [ativo, setAtivo] = useState(-1);
  const selecionado = veiculos.find(v => v.id === valor);
  const termo = normalizar(busca);
  const opcoes = veiculos.filter(v => normalizar(v.placa + ' ' + v.modelo).includes(termo));

  function fechar() {
    setAberto(false); setBusca(''); setAtivo(-1);
  }
  function escolher(id: string) {
    aoSelecionar(id); fechar();
  }
  function teclado(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape' && aberto) {
      e.preventDefault(); e.stopPropagation(); fechar();
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault(); setAberto(true);
      if (!opcoes.length) return;
      const passo = e.key === 'ArrowDown' ? 1 : -1;
      const posicao = ativo < 0 ? (passo > 0 ? 0 : opcoes.length - 1) : Math.max(0, Math.min(opcoes.length - 1, ativo + passo));
      setAtivo(posicao);
      requestAnimationFrame(() => document.getElementById(lista + '-' + posicao)?.scrollIntoView?.({block:'nearest'}));
    } else if (e.key === 'Enter' && aberto) {
      e.preventDefault();
      if (opcoes[ativo]) escolher(opcoes[ativo].id);
    }
  }

  return <div className="manutencoes__combobox">
    <input {...aria} role="combobox" aria-label="Veículo" aria-required="true"
      aria-expanded={aberto} aria-controls={aberto ? lista : undefined} aria-autocomplete="list"
      aria-activedescendant={aberto && opcoes[ativo] ? lista + '-' + ativo : undefined}
      autoComplete="off" disabled={desabilitado}
      placeholder={aberto ? 'Buscar placa ou modelo' : 'Selecione'}
      value={aberto ? busca : selecionado ? rotulo(selecionado) : ''}
      onClick={() => setAberto(true)} onFocus={e => e.currentTarget.select()} onBlur={fechar} onKeyDown={teclado}
      onChange={e => {setAberto(true); setBusca(e.target.value); setAtivo(-1);}}/>
    <span className="manutencoes__combobox-seta" aria-hidden="true"/>
    {aberto && <div className="manutencoes__combobox-opcoes">
      <ul id={lista} role="listbox" aria-label="Veículos">
        {opcoes.map((v,i) => <li id={lista + '-' + i} key={v.id} data-value={v.id} role="option"
          aria-selected={v.id === valor} className={i === ativo ? 'manutencoes__opcao-ativa' : undefined}
          onPointerDown={e => e.preventDefault()} onClick={e => { e.preventDefault(); escolher(v.id); }}>{rotulo(v)}</li>)}
      </ul>
      {!opcoes.length && <p role="status">Nenhum veículo encontrado.</p>}
    </div>}
  </div>;
}
