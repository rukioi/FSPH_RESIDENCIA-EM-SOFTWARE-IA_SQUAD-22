import Busboy from 'busboy';
import type { IncomingMessage } from 'node:http';

const TAMANHO_MAXIMO = 5 * 1024 * 1024;

const TIPOS_PERMITIDOS = [
  'application/pdf',
  'image/jpeg',
  'image/png',
];

export interface ArquivoDocumento {
  nome: string;
  tipo: string;
  conteudo: Buffer;
}

export interface DadosUpload {
  campos: Record<string, string>;
  arquivo: ArquivoDocumento;
}

export async function receberUpload(
  req: IncomingMessage,
): Promise<DadosUpload> {
  return new Promise((resolve, reject) => {
    const campos: Record<string, string> = {};
    const partes: Buffer[] = [];

    let nomeArquivo = '';
    let tipoArquivo = '';
    let arquivoRecebido = false;
    let arquivoInvalido = false;
    let tamanhoExcedido = false;
    let quantidadeArquivos = 0;

    const parser = Busboy({
      headers: req.headers,
      limits: {
        fileSize: TAMANHO_MAXIMO,
        files: 1,
        fields: 10,
      },
    });

    parser.on('field', (nome, valor) => {
      campos[nome] = valor;
    });

    parser.on('file', (_campo, arquivo, info) => {
      quantidadeArquivos++;

      nomeArquivo = info.filename ?? '';
      tipoArquivo = info.mimeType;

      if (!TIPOS_PERMITIDOS.includes(tipoArquivo)) {
        arquivoInvalido = true;
      }

      arquivo.on('data', (parte: Buffer) => {
        partes.push(parte);
      });

      arquivo.on('limit', () => {
        tamanhoExcedido = true;
      });

      arquivo.on('end', () => {
        arquivoRecebido = true;
      });
    });

    parser.on('filesLimit', () => {
      arquivoInvalido = true;
    });

    parser.on('error', reject);

    parser.on('close', () => {
      if (tamanhoExcedido) {
        reject(new Error('ARQUIVO_MUITO_GRANDE'));
        return;
      }

      if (
        !arquivoRecebido ||
        arquivoInvalido ||
        quantidadeArquivos !== 1 ||
        !nomeArquivo
      ) {
        reject(new Error('ARQUIVO_INVALIDO'));
        return;
      }

      resolve({
        campos,
        arquivo: {
          nome: nomeArquivo,
          tipo: tipoArquivo,
          conteudo: Buffer.concat(partes),
        },
      });
    });

    req.pipe(parser);
  });
}