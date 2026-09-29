export function extrairDuracaoAudio(arquivo: File): Promise<{ duracao_seg: number } | null> {
  return new Promise((resolve) => {
    const audio = document.createElement("audio");
    audio.preload = "metadata";
    audio.onloadedmetadata = () => {
      URL.revokeObjectURL(audio.src);
      resolve(Number.isFinite(audio.duration) ? { duracao_seg: Math.round(audio.duration * 10) / 10 } : null);
    };
    audio.onerror = () => { URL.revokeObjectURL(audio.src); resolve(null); };
    audio.src = URL.createObjectURL(arquivo);
  });
}

export function extrairMetadadosVideo(arquivo: File): Promise<{ duracao_seg: number; orientacao: "vertical" | "horizontal" } | null> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      const duracao = video.duration;
      const orientacao = video.videoWidth >= video.videoHeight ? "horizontal" : "vertical";
      URL.revokeObjectURL(video.src);
      resolve(Number.isFinite(duracao) ? { duracao_seg: Math.round(duracao * 10) / 10, orientacao } : null);
    };
    video.onerror = () => { URL.revokeObjectURL(video.src); resolve(null); };
    video.src = URL.createObjectURL(arquivo);
  });
}

export async function extrairMetadadosArquivo(arquivo: File): Promise<Record<string, unknown> | null> {
  if (arquivo.type.startsWith("audio/")) return extrairDuracaoAudio(arquivo);
  if (arquivo.type.startsWith("video/")) return extrairMetadadosVideo(arquivo);
  return null;
}
