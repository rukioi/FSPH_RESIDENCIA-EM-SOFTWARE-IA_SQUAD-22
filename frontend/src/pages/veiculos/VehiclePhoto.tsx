import { useEffect, useRef, useState } from 'react';
import { buscarFotoVeiculo, type FotoVeiculo } from '../../shared/services/veiculos.service';
import { VehicleImage } from './VehiclePresentation';

/** Busca a foto privada por sessão; a ilustração continua disponível quando não há foto. */
export function VehiclePhoto({ id, tipo, versao = 0, eager = false }: { id: string; tipo: string | null; versao?: number; eager?: boolean }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    setSrc(null);
    void buscarFotoVeiculo(id, controller.signal).then(foto => {
      if (!controller.signal.aborted && foto) setSrc(`data:${foto.tipo};base64,${foto.dadosBase64}`);
    }).catch(() => { if (!controller.signal.aborted) setSrc(null); });
    return () => controller.abort();
  }, [id, versao]);
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
