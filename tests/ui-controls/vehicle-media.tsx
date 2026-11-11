import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { VehicleImage } from '../../frontend/src/pages/veiculos/VehiclePresentation';
import '../../frontend/src/pages/veiculos/Veiculos.css';

function App() {
  const [src, setSrc] = useState('/fixture-image/first.svg');
  return <><button onClick={() => setSrc('/fixture-image/missing.svg')}>Imagem indisponível</button>
    <button onClick={() => setSrc('/fixture-image/second.svg')}>Outra imagem</button>
    <div style={{ width: 300, height: 160 }}><VehicleImage tipo="VAN" src={src} alt="Veículo de teste" /></div></>;
}
createRoot(document.getElementById('root')!).render(<App />);
