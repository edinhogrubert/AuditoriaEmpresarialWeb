import { BrowserMultiFormatReader } from '@zxing/library';

/**
 * Reads a QR code or barcode directly from an image file (e.g. screenshot or photo of a phone screen).
 */
export async function decodeQrFromImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('O arquivo selecionado não é uma imagem válida.'));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Erro ao ler arquivo de imagem.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Não foi possível carregar a imagem.'));
      img.onload = async () => {
        try {
          const codeReader = new BrowserMultiFormatReader();
          const result = await codeReader.decodeFromImageElement(img);
          if (result && result.getText()) {
            resolve(result.getText());
          } else {
            reject(new Error('Nenhum QR Code ou Código de Barras encontrado na imagem. Certifique-se de que a tela do celular esteja limpa e nítida.'));
          }
        } catch (err: any) {
          reject(new Error('Não foi possível reconhecer o QR Code da foto da tela. Certifique-se de que o QR Code esteja bem enquadrado.'));
        }
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}
