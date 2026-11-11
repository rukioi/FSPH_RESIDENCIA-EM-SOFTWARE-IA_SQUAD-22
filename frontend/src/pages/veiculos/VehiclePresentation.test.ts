import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { VehicleImage, VehicleStatusBadge, formatarQuilometragem, vehicleTitle, vehicleTypeLabel } from './VehiclePresentation';

describe('apresentação de veículos', () => {
  it('evita duplicar somente a marca inteira no início do modelo', () => {
    expect(vehicleTitle('Ford', 'ford Transit')).toBe('Ford Transit');
    expect(vehicleTitle('Chevrolet', 'Chevrolet chevrolet S10')).toBe('Chevrolet S10');
    expect(vehicleTitle('Ford', 'Ford Fordson')).toBe('Ford Fordson');
    expect(vehicleTitle('Ford', 'Ford')).toBe('Ford');
    expect(vehicleTitle('Ford', 'Fordson')).toBe('Ford Fordson');
    expect(vehicleTitle('Ford', 'Transit Ford')).toBe('Ford Transit Ford');
    expect(vehicleTitle(null, null)).toBe('Veículo não informado');
  });
  it('formata tipos e quilometragem preservando valores legados', () => {
    expect(vehicleTypeLabel('RABECÃO_SVO')).toBe('Rabecão SVO');
    expect(vehicleTypeLabel('OUTRO')).toBe('OUTRO');
    expect(formatarQuilometragem(12345)).toBe('12.345 km');
    expect(formatarQuilometragem(null)).toBe('Não informada');
    expect(formatarQuilometragem('desconhecida')).toBe('desconhecida km');
  });
  it('renderiza classes e rótulos de status existentes', () => {
    expect(renderToStaticMarkup(createElement(VehicleStatusBadge, { status: 'Em manutenção' }))).toContain('veiculo-status--em-manutencao');
    expect(renderToStaticMarkup(createElement(VehicleStatusBadge, { status: null }))).toContain('Não informado');
  });
  it('renderiza ilustrações locais e foto opcional com carregamento preguiçoso', () => {
    const types = ['PASSEIO', 'VAN', 'AMBULANCIA', 'RABECÃO_SVO', 'OUTRO'];
    const images = types.map(tipo => renderToStaticMarkup(createElement(VehicleImage, { tipo })));
    expect(new Set(images).size).toBe(types.length);
    expect(images.every(image => image.includes('vehicle-image__illustration'))).toBe(true);
    expect(images[0]).toContain('aria-label="Ilustração de veículo: Passeio"');
    const photo = renderToStaticMarkup(createElement(VehicleImage, { src: '/foto.jpg', alt: 'Veículo' }));
    expect(photo).toContain('loading="lazy"');
    expect(photo).toContain('alt="Veículo"');
  });
});
