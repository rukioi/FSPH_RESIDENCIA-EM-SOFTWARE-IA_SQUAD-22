// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { Documentos } from './Documentos'
import { DocumentosAdm } from '../../pages/administrador/DocumentosAdm'
import { DocumentosGestor } from '../../pages/gerente/DocumentosGestor'
import type {
  DocumentoGestao,
  FiltrosDocumentos,
} from '../../shared/services/documentos.service'

const mocks = vi.hoisted(() => ({
  consultar: vi.fn(),
  detalhar: vi.fn(),
  historico: vi.fn(),
  editar: vi.fn(),
}))

vi.mock('../../shared/services/documentos.service', () => ({
  consultarDocumentos: mocks.consultar,
  buscarDetalheDocumento: mocks.detalhar,
  buscarHistoricoDocumento: mocks.historico,
  editarDocumento: mocks.editar,
}))

const cnh: DocumentoGestao = {
  id: '8',
  tipo: 'CNH_MOTORISTA',
  registroId: '8',
  dataValidade: '2026-12-31',
  tipoDocumento: null,
  numeroCnh: '123456',
  categoriaCnh: 'B',
  regular: false,
  diasRestantes: 20,
  versao: 1,
}

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.open = true
  }
  HTMLDialogElement.prototype.close = function close() {
    this.open = false
    this.dispatchEvent(new Event('close'))
  }
})

beforeEach(() => {
  mocks.consultar.mockReset()
  mocks.detalhar.mockReset()
  mocks.historico.mockReset()
  mocks.editar.mockReset()
  mocks.consultar.mockImplementation((filtros: FiltrosDocumentos = {}) =>
    Promise.resolve({
      data: filtros.limit === 20 ? [cnh] : [],
      meta: { total: filtros.limit === 20 ? 1 : 0 },
    }),
  )
  mocks.detalhar.mockResolvedValue({ data: cnh })
  mocks.historico.mockResolvedValue({ data: [], meta: { total: 0 } })
})

afterEach(cleanup)

describe('Gestão de documentos integrada ao service', () => {
  it.each([
    ['ADM', DocumentosAdm],
    ['Gestor', DocumentosGestor],
  ])('renderiza a página %s com os dados retornados pelo service', async (_perfil, Pagina) => {
    render(<Pagina />)
    expect(await screen.findByText('CNH B')).toBeInTheDocument()
    expect(mocks.consultar).toHaveBeenCalled()
  })

  it('combina aba, relacionamento e período nos parâmetros da consulta', async () => {
    render(<Documentos />)
    expect(await screen.findByText('CNH B')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: 'A vencer' }))
    await waitFor(() => {
      expect(mocks.consultar).toHaveBeenCalledWith(
        { situacao: 'A_VENCER', page: 1, limit: 20 },
        expect.any(AbortSignal),
      )
    })

    fireEvent.click(screen.getByText('Filtros de documentos'))
    fireEvent.change(screen.getByLabelText('ID do veículo'), {
      target: { value: '12' },
    })
    fireEvent.change(screen.getByLabelText('Validade inicial'), {
      target: { value: '2026-01-01' },
    })
    fireEvent.change(screen.getByLabelText('Validade final'), {
      target: { value: '2026-12-31' },
    })

    const aplicar = screen.getByRole('button', { name: 'Aplicar filtros' })
    await waitFor(() => expect(aplicar).toBeEnabled())
    fireEvent.click(aplicar)

    await waitFor(() => {
      expect(mocks.consultar).toHaveBeenCalledWith(
        {
          situacao: 'A_VENCER',
          veiculoId: '12',
          inicio: '2026-01-01',
          fim: '2026-12-31',
          page: 1,
          limit: 20,
        },
        expect.any(AbortSignal),
      )
    })
  })

  it('busca os detalhes e edita a CNH com a versão atual', async () => {
    mocks.editar.mockResolvedValue({
      data: { ...cnh, numeroCnh: '999999', versao: 2 },
    })
    render(<Documentos />)

    fireEvent.click(
      await screen.findByRole('button', { name: 'Visualizar CNH B' }),
    )
    await screen.findByText('123456')
    expect(mocks.detalhar).toHaveBeenCalledWith(
      '8',
      'CNH_MOTORISTA',
      expect.any(AbortSignal),
    )

    fireEvent.click(screen.getByRole('button', { name: 'Editar' }))
    fireEvent.change(screen.getByLabelText('Número da CNH'), {
      target: { value: '999999' },
    })
    fireEvent.change(screen.getByLabelText('Validade'), {
      target: { value: '2027-01-31' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }))

    await waitFor(() => {
      expect(mocks.editar).toHaveBeenCalledWith('8', 'CNH_MOTORISTA', {
        versao: 1,
        dataValidade: '2027-01-31',
        numeroCnh: '999999',
        categoriaCnh: 'B',
      })
    })
    expect(await screen.findByText('Documento atualizado com sucesso.')).toBeInTheDocument()
  })

  it('mostra falha da API e permite repetir a consulta', async () => {
    mocks.consultar.mockImplementation((filtros: FiltrosDocumentos = {}) => {
      if (filtros.limit === 20 && mocks.consultar.mock.calls.length === 1) {
        return Promise.reject(new Error('Falha controlada de teste'))
      }
      return Promise.resolve({ data: [], meta: { total: 0 } })
    })
    render(<Documentos />)

    expect(
      await screen.findByText('Não foi possível concluir a consulta. Tente novamente.'),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    expect(await screen.findByText('Nenhum documento cadastrado.')).toBeInTheDocument()
  })
})
