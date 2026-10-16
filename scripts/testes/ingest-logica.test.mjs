// Regras do worker de ingestao (scripts/worker/ingest-logica.mjs).
import test from "node:test";
import assert from "node:assert/strict";
import * as L from "../worker/ingest-logica.mjs";

test("so video entra; arquivo escondido e parcial ficam de fora", () => {
  assert.ok(L.ehVideo("Live 14-10.MKV"));
  assert.ok(L.ehVideo("parte1.mp4"));
  assert.ok(!L.ehVideo(".parte1.mp4"));
  assert.ok(!L.ehVideo("gravando.mp4.part"));
  assert.ok(!L.ehVideo("capa.png"));
});

test("arquivo so entra quando parou de crescer ha 20 s", () => {
  const agora = 1_000_000;
  assert.ok(!L.arquivoEstavel(undefined, { tamanho: 10, mtimeMs: 0 }, agora));
  assert.ok(!L.arquivoEstavel({ tamanho: 5, mtimeMs: 0 }, { tamanho: 10, mtimeMs: 0 }, agora));
  assert.ok(!L.arquivoEstavel({ tamanho: 10, mtimeMs: agora - 5000 }, { tamanho: 10, mtimeMs: agora - 5000 }, agora));
  assert.ok(L.arquivoEstavel({ tamanho: 10, mtimeMs: agora - 30000 }, { tamanho: 10, mtimeMs: agora - 30000 }, agora));
  assert.ok(!L.arquivoEstavel({ tamanho: 0, mtimeMs: 0 }, { tamanho: 0, mtimeMs: 0 }, agora));
});

test("subpasta vira sessao; arquivo solto vai para a sessao do dia", () => {
  const ms = new Date(2026, 9, 15, 20, 0).getTime();
  assert.deepEqual(L.sessaoDoArquivo("Live 14-10/parte1.mp4", ms), { chave: "pasta:Live 14-10", nome: "Live 14-10", data: "2026-10-15", pasta: "Live 14-10" });
  assert.deepEqual(L.sessaoDoArquivo("solto.mp4", ms), { chave: "dia:2026-10-15", nome: "Gravação 15/10/2026", data: "2026-10-15", pasta: null });
  assert.equal(L.sessaoDoArquivo("Gameplay\\cena.mkv", ms).nome, "Gameplay");
});

test("proxy cabe no limite do bucket, de 1 min a 6 h", () => {
  for (const dur of [60, 600, 3600, 3 * 3600, 6 * 3600]) {
    const p = L.planoProxy(dur);
    const bytes = ((p.videoKbps + p.audioKbps) * 1000 / 8) * dur;
    assert.ok(bytes <= L.LIMITE_PROXY_BYTES || p.videoKbps === 120, `${dur}s gera ${Math.round(bytes / 1e6)} MB`);
  }
  assert.equal(L.planoProxy(60).altura, 720);
  assert.equal(L.planoProxy(3 * 3600).altura, 360);
  assert.ok(L.planoProxy(3600).videoKbps <= 1500);
});

test("escala respeita vertical e nao aumenta video pequeno", () => {
  assert.equal(L.filtroEscala(1920, 1080, 540), "scale=-2:540");
  assert.equal(L.filtroEscala(1080, 1920, 540), "scale=540:-2");
  assert.equal(L.filtroEscala(640, 360, 540), "scale=trunc(iw/2)*2:trunc(ih/2)*2");
});

test("le o ffprobe (duracao, resolucao, fps, audio, rotacao)", () => {
  const m = L.lerFfprobe({
    format: { duration: "3723.456", bit_rate: "6000000" },
    streams: [
      { codec_type: "video", codec_name: "h264", width: 1920, height: 1080, avg_frame_rate: "60000/1001" },
      { codec_type: "audio", codec_name: "aac", channels: 2 },
    ],
  });
  assert.equal(m.duracao_seg, 3723.46);
  assert.equal(m.fps, 59.94);
  assert.equal(m.tem_audio, true);
  assert.equal(m.orientacao, "horizontal");
  assert.equal(m.bitrate_kbps, 6000);
  const celular = L.lerFfprobe({ format: { duration: "10" }, streams: [{ codec_type: "video", width: 1920, height: 1080, tags: { rotate: "90" } }] });
  assert.equal(celular.orientacao, "vertical");
  assert.equal(celular.tem_audio, false);
  assert.equal(L.lerFfprobe({}).duracao_seg, null);
});

test("progresso do ffmpeg e mensagem segura", () => {
  assert.equal(L.progressoDaLinha("out_time_ms=30000000", 60), 50);
  assert.equal(L.progressoDaLinha("out_time_ms=999000000", 60), 99);
  assert.equal(L.progressoDaLinha("frame=10", 60), null);
  const msg = L.mensagemSegura(new Error("ffmpeg version 9\nC:\\Users\\X\\Videos\\a.mp4: Invalid data found when processing input"));
  assert.ok(!msg.includes("Users"));
  assert.match(msg, /Invalid data/);
  const comEspaco = L.mensagemSegura("C:\\Users\\LIVIA ANDRADE\\Videos\\Live 1.mp4: No such file or directory");
  assert.equal(comEspaco, "(arquivo): No such file or directory");
});
