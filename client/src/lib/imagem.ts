// Redimensiona e comprime uma imagem no cliente antes de a enviar,
// para poupar largura de banda e tokens da IA.
// Lado maior ~1500px, JPEG qualidade ~0.8.
export async function comprimirImagem(
  ficheiro: File,
  ladoMaximo = 1500,
  qualidade = 0.8
): Promise<Blob> {
  const dataUrl = await lerComoDataURL(ficheiro);
  const img = await carregarImagem(dataUrl);

  let { width, height } = img;
  if (Math.max(width, height) > ladoMaximo) {
    const escala = ladoMaximo / Math.max(width, height);
    width = Math.round(width * escala);
    height = Math.round(height * escala);
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return ficheiro; // fallback: envia o original
  ctx.drawImage(img, 0, 0, width, height);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", qualidade)
  );
  return blob ?? ficheiro;
}

function lerComoDataURL(ficheiro: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(ficheiro);
  });
}

function carregarImagem(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
