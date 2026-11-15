import { useEffect, useRef, useState } from 'react';
import { buscarFotoVeiculo, type FotoVeiculo } from '../../shared/services/veiculos.service';
import { VehicleImage } from './VehiclePresentation';
import { ApiError } from '../../shared/api/errors';

/** Busca a foto privada por sessão; a ilustração continua disponível quando não há foto. */
export function VehiclePhoto({ id, tipo, versao = 0, eager = false }: { id: string; tipo: string | null; versao?: number; eager?: boolean }) {
  const container = useRef<HTMLDivElement>(null);
  const [visivel, setVisivel] = useState(eager);
  useEffect(() => {
    if (eager || !('IntersectionObserver' in window)) { setVisivel(true); return; }
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { setVisivel(true); observer.disconnect(); }
    }, { rootMargin: '240px' });
    if (container.current) observer.observe(container.current);
    return () => observer.disconnect();
  }, [eager]);
  return <div ref={container} style={{ width: '100%', height: '100%' }}>
    {visivel ? <VehiclePhotoLoaded key={id} id={id} tipo={tipo} versao={versao} eager={eager} /> : <span className="vehicle-image" role="status">Carregando foto...</span>}
  </div>;
}

function VehiclePhotoLoaded({ id, tipo, versao, eager }: { id: string; tipo: string | null; versao: number; eager: boolean }) {
  const [src, setSrc] = useState<string | null>(null);
  const [estado, setEstado] = useState<'carregando' | 'pronto' | 'erro'>('carregando');
  const [tentativa, setTentativa] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setSrc(null);
    setEstado('carregando');
    void buscarFotoVeiculo(id, controller.signal).catch(error => {
      if (!controller.signal.aborted && error instanceof ApiError && error.status === 503) return buscarFotoVeiculo(id, controller.signal);
      throw error;
    }).then(foto => {
      if (!controller.signal.aborted) {
        if (foto) setSrc(`data:${foto.tipo};base64,${foto.dadosBase64}`);
        setEstado('pronto');
      }
    }).catch(() => { if (!controller.signal.aborted) setEstado('erro'); });
    return () => controller.abort();
  }, [id, versao, tentativa]);
  if (estado === 'carregando') return <span className="vehicle-image" role="status">Carregando foto...</span>;
  if (estado === 'erro') return <span className="vehicle-image"><span role="alert">Não foi possível carregar a foto.</span><button type="button" style={{ minHeight: 40 }} onClick={() => setTentativa(value => value + 1)}>Tentar novamente</button></span>;
  return <VehicleImage tipo={tipo} src={src} eager={eager} />;
}

/** Seleciona e pré-visualiza imagem opcional sem salvá-la no navegador. */
export function VehiclePhotoInput({ foto, onChange }: { foto: FotoVeiculo | null; onChange: (foto: FotoVeiculo | null) => void }) {
  const [erro, setErro] = useState('');
  const leitura = useRef(0);
  useEffect(() => () => { leitura.current++; }, []);
  return <div className="veiculos-foto-input">
    <label>Foto do veículo (opcional)
      <input type="file" accept="image/jpeg,image/png" onChange={event => {
        const atual = ++leitura.current;
        const file = event.target.files?.[0];
        setErro(''); onChange(null);
        if (!file) return;
        if (!['image/jpeg', 'image/png'].includes(file.type) || file.size > 1024 * 1024 || !file.size) {
          setErro('Selecione uma imagem JPEG ou PNG de até 1 MB.'); event.target.value = ''; return;
        }
        const reader = new FileReader();
        reader.onerror = () => { if (atual === leitura.current) setErro('Não foi possível ler a imagem.'); };
        reader.onload = () => {
          if (atual === leitura.current && typeof reader.result === 'string') onChange({ tipo: file.type as FotoVeiculo['tipo'], dadosBase64: reader.result.split(',')[1] });
        };
        reader.readAsDataURL(file);
      }} />
    </label>
    <small>JPEG ou PNG, até 1 MB. Sem foto, será usada a ilustração padrão.</small>
    {erro && <p role="alert">{erro}</p>}
    {foto && <img className="veiculos-foto-input__preview" src={`data:${foto.tipo};base64,${foto.dadosBase64}`} alt="Prévia da foto selecionada" />}
  </div>;
}
