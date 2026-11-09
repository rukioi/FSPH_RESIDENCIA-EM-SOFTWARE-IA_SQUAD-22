import { useState } from 'react';

const statusNames: Record<string, string> = {
  DISPONIVEL: 'Disponível', EM_VIAGEM: 'Em viagem',
  EM_MANUTENCAO: 'Em manutenção', INDISPONIVEL: 'Indisponível',
};

/** Apresenta o estado do veículo com os mesmos rótulos e classes do módulo. */
export function VehicleStatusBadge({ status }: { status?: string | null }) {
  const key = (status ?? '').trim().toUpperCase().normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').replace(/[ -]/g, '_');
  return <span className={`veiculo-status veiculo-status--${key.toLowerCase().replace(/_/g, '-')}`}>
    {statusNames[key] ?? status ?? 'Não informado'}
  </span>;
}

/** Combina marca e modelo, removendo somente uma marca repetida no início do modelo. */
export function vehicleTitle(marca?: string | null, modelo?: string | null): string {
  const brand = marca?.trim() ?? '';
  const model = modelo?.trim() ?? '';
  if (!brand) return model || 'Veículo não informado';
  if (!model) return brand;
  let remaining = model;
  let repeated = false;
  while (remaining.slice(0, brand.length).localeCompare(brand, 'pt-BR', { sensitivity: 'accent' }) === 0 &&
      (remaining.length === brand.length || /\s/.test(remaining[brand.length]))) {
    remaining = remaining.slice(brand.length).trimStart();
    repeated = true;
  }
  if (repeated) return remaining ? `${brand} ${remaining}` : brand;
  return `${brand} ${model}`;
}

/** Traduz os tipos previstos no contrato, preservando valores desconhecidos. */
export function vehicleTypeLabel(tipo?: string | null): string {
  const labels: Record<string, string> = { PASSEIO: 'Passeio', VAN: 'Van', AMBULANCIA: 'Ambulância', 'RABECÃO_SVO': 'Rabecão SVO' };
  return tipo ? labels[tipo] ?? tipo : 'Não informado';
}

/** Formata quilometragem conforme a convenção já usada na tela de veículos. */
export function formatarQuilometragem(valor?: number | string | null): string {
  if (valor === undefined || valor === null || valor === '') return 'Não informada';
  const numero = Number(valor);
  return `${Number.isNaN(numero) ? valor : new Intl.NumberFormat('pt-BR').format(numero)} km`;
}

type ImageProps = { tipo?: string | null; src?: string | null; alt?: string; eager?: boolean };

function VehicleIllustration({ tipo }: { tipo?: string | null }) {
  const passeio = tipo === 'PASSEIO';
  const ambulance = tipo === 'AMBULANCIA';
  const rabecao = tipo === 'RABECÃO_SVO';
  const van = tipo === 'VAN' || ambulance || rabecao;
  return <svg className="vehicle-image__illustration" viewBox="0 0 320 150" aria-hidden="true" focusable="false">
    <ellipse cx="160" cy="127" rx="137" ry="10" fill="#dbe4eb" />
    {passeio ? <>
      <path d="M27 104 L34 83 Q38 75 64 71 L100 43 Q108 37 126 37 H190 Q205 38 222 61 L251 70 Q276 74 286 87 L291 104 Z" fill="#cbd8e0" stroke="#526a79" strokeWidth="3" strokeLinejoin="round" />
      <path d="M80 70 L108 48 Q112 45 126 45 H143 V70 Z M151 45 H188 Q199 45 214 69 L151 70 Z" fill="#7995a5" stroke="#526a79" strokeWidth="2" />
      <path d="M145 43 V103 M218 70 L224 102 M29 94 H289" fill="none" stroke="#839aa8" strokeWidth="2" />
    </> : van ? <>
      <path d="M30 103 V47 Q30 35 43 35 H190 Q203 35 215 48 L249 72 L275 77 Q286 80 289 93 V103 Z" fill="#dce5eb" stroke="#526a79" strokeWidth="3" strokeLinejoin="round" />
      <path d="M43 47 H88 V70 H43 Z M96 47 H142 V70 H96 Z M150 47 H187 Q197 47 205 56 L217 70 H150 Z" fill="#7995a5" stroke="#526a79" strokeWidth="2" />
      <path d="M145 37 V103 M220 72 V102 M30 87 H285" fill="none" stroke="#91a5b1" strokeWidth="2" />
      {ambulance && <><path d="M30 81 H283 V90 H30 Z" fill="#d76666" /><path d="M98 48 H108 V55 H115 V64 H108 V71 H98 V64 H91 V55 H98 Z" fill="#c84f55" /><path d="M157 29 H184 V35 H157 Z" fill="#d76666" /></>}
      {rabecao && <><path d="M31 79 H221 V90 H31 Z" fill="#6e8290" /><path d="M48 49 H86 V69 H48 Z" fill="#556e7c" /></>}
    </> : <>
      <path d="M30 103 L37 78 Q40 69 58 67 L92 47 Q102 41 117 41 H190 Q202 41 214 54 L239 70 L273 76 Q286 79 290 94 V103 Z" fill="#d5e0e6" stroke="#526a79" strokeWidth="3" strokeLinejoin="round" />
      <path d="M79 68 L108 50 H143 V68 Z M151 50 H187 Q197 50 207 61 L215 68 H151 Z" fill="#8ba2af" stroke="#526a79" strokeWidth="2" />
      <path d="M146 46 V103 M28 92 H289" fill="none" stroke="#91a5b1" strokeWidth="2" />
    </>}
    <path d="M27 103 H293 V111 H27 Z" fill="#526a79" />
    {[78, 241].map(cx => <g key={cx}><circle cx={cx} cy="109" r="19" fill="#344955" /><circle cx={cx} cy="109" r="10" fill="#e4ebef" stroke="#8096a3" strokeWidth="2" /><circle cx={cx} cy="109" r="3" fill="#8096a3" /></g>)}
    <path d="M277 84 H288 M32 84 H41" stroke="#f5cf82" strokeWidth="4" strokeLinecap="round" />
  </svg>;
}

function VehicleImageContent({ tipo, src, alt, eager }: ImageProps) {
  const [failed, setFailed] = useState(false);
  return <span className="vehicle-image" {...(!src || failed ? { role: 'img', 'aria-label': `Ilustração de veículo: ${vehicleTypeLabel(tipo)}` } : {})}>
    {src && !failed ? <img className="vehicle-image__photo" src={src} alt={alt ?? 'Fotografia do veículo'} loading={eager ? 'eager' : 'lazy'} onError={() => setFailed(true)} /> : <VehicleIllustration tipo={tipo} />}
  </span>;
}

/** Exibe uma foto opcional ou uma ilustração local para o tipo do veículo. */
export function VehicleImage(props: ImageProps) {
  return <VehicleImageContent key={props.src ?? ''} {...props} />;
}
