"use client";

import { useEffect, useState } from "react";
import { X, HardDrive, RotateCcw, Copy, Film } from "lucide-react";
import { useToast } from "@/components/ToastProvider";
import { urlAssinadaBruto } from "@/lib/production/storage";
import { urlsAssinadas } from "@/lib/storage";
import { formatarTimecode } from "@/lib/timecode";
import { ROTULO_STATUS_BRUTO } from "@/lib/production/rotulos";
import type { Bruto } from "@/lib/production/types";

// Gaveta do bruto. Toca o proxy da nuvem (ou o arquivo enviado pelo navegador);
// o original fica no PC e aparece so como caminho.
export default function BrutoDetalhe({ bruto, onFechar, onReprocessar }: { bruto: Bruto; onFechar: () => void; onReprocessar?: () => void }) {
  const toast = useToast();
  const [video, setVideo] = useState<string | null>(null);
  const [imagens, setImagens] = useState<Record<string, string>>({});

  useEffect(() => {
    let vivo = true;
    const caminho = bruto.proxy_url ?? bruto.arquivo_url;
    if (caminho) urlAssinadaBruto(caminho).then((u) => { if (vivo) setVideo(u); });
    urlsAssinadas([bruto.miniatura_url, bruto.sprite_url]).then((m) => { if (vivo) setImagens(m); });
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onFechar(); };
    window.addEventListener("keydown", esc);
    return () => { vivo = false; window.removeEventListener("keydown", esc); };
  }, [bruto, onFechar]);

  const m = bruto.metadados;
  const linhas: [string, string][] = [
    ["Duração", bruto.duracao_seg ? formatarTimecode(bruto.duracao_seg * 1000) : "ainda não lida"],
    ["Resolução", m?.largura ? `${m.largura} × ${m.altura}${m.orientacao === "vertical" ? " (vertical)" : ""}` : "-"],
    ["Quadros", m?.fps ? `${m.fps} fps` : "-"],
    ["Áudio", m ? (m.tem_audio ? `${m.codec_audio ?? "sim"}${m.canais_audio ? `, ${m.canais_audio} canal(is)` : ""}` : "sem áudio") : "-"],
    ["Tamanho", bruto.tamanho_bytes ? `${(bruto.tamanho_bytes / 1e9).toFixed(2)} GB` : "-"],
    ["Status", ROTULO_STATUS_BRUTO[bruto.status]],
  ];

  async function copiarCaminho() {
    if (!bruto.caminho_local) return;
    try { await navigator.clipboard.writeText(bruto.caminho_local); toast("Caminho copiado"); } catch { toast("Não consegui copiar"); }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/60" onClick={onFechar} />
      <div role="dialog" aria-modal="true" aria-label={bruto.nome} className="relative flex h-full w-full max-w-xl flex-col border-l border-neutral-800 bg-neutral-950">
        <div className="flex items-center justify-between gap-2 border-b border-neutral-800 px-5 py-4">
          <p className="min-w-0 truncate text-sm font-medium text-neutral-100">{bruto.nome}</p>
          <button onClick={onFechar} aria-label="Fechar" className="text-neutral-500 hover:text-neutral-200"><X className="h-4 w-4" /></button>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {video ? (
            <video src={video} controls playsInline preload="metadata" poster={bruto.miniatura_url ? imagens[bruto.miniatura_url] : undefined} className="max-h-[320px] w-full rounded bg-black object-contain" />
          ) : (
            <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded border border-dashed border-neutral-800 text-center text-xs text-neutral-500">
              <Film className="h-5 w-5" />
              {bruto.status === "processando" ? "O worker do PC está preparando o proxy." : "Sem proxy na nuvem. O vídeo está só no PC."}
            </div>
          )}
          {bruto.proxy_url && <p className="text-[10px] text-neutral-500">Tocando o proxy leve. O original, em qualidade cheia, fica no PC.</p>}

          {bruto.sprite_url && imagens[bruto.sprite_url] && (
            <div>
              <p className="mb-1 text-[10px] uppercase tracking-wide text-neutral-500">Ao longo do vídeo</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imagens[bruto.sprite_url]} alt="Miniaturas ao longo do vídeo" className="w-full rounded" />
            </div>
          )}

          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
            {linhas.map(([k, v]) => (
              <div key={k}>
                <dt className="text-[10px] uppercase tracking-wide text-neutral-500">{k}</dt>
                <dd className="text-neutral-200">{v}</dd>
              </div>
            ))}
          </dl>

          {bruto.status === "erro" && bruto.erro_mensagem && <p className="rounded border border-[#F0997B]/40 p-2 text-xs text-[#F0997B]">{bruto.erro_mensagem}</p>}

          {bruto.caminho_local && (
            <div>
              <p className="mb-1 flex items-center gap-1 text-[10px] uppercase tracking-wide text-neutral-500"><HardDrive className="h-3 w-3" /> Original no PC</p>
              <div className="flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded bg-neutral-900 px-2 py-1 text-[11px] text-neutral-300" title={bruto.caminho_local}>{bruto.caminho_local}</code>
                <button onClick={copiarCaminho} aria-label="Copiar caminho" className="flex h-8 w-8 items-center justify-center rounded-md border border-neutral-800 text-neutral-400 hover:text-teal-300"><Copy className="h-3.5 w-3.5" /></button>
              </div>
            </div>
          )}

          {onReprocessar && bruto.caminho_local && bruto.status !== "processando" && (
            <button onClick={onReprocessar} className="flex min-h-[36px] items-center gap-1.5 rounded-md border border-neutral-800 px-3 text-xs text-neutral-300 hover:text-teal-300">
              <RotateCcw className="h-3.5 w-3.5" /> Preparar de novo (metadados, miniaturas e proxy)
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
