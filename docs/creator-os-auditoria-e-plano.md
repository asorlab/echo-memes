# ECHO Creator OS: auditoria e plano por fases

Data: 15/10/2026. Documento de planejamento. Nada foi implementado, nenhuma migration foi rodada, nenhum dado foi lido ou alterado no banco. Tudo abaixo vem da leitura do código dos dois repositórios (`echo-memes` e `echo-os-app-`) e da documentação oficial de cada tecnologia.

---

## 1. Resumo em 10 linhas

1. O ECHO // ASSETS (`echo-memes`, Next.js 14, deploy `echo-memes.vercel.app`) tem **18 telas, ~50 tabelas e RLS dono-only com checagem de posse** nos vínculos. A base é boa.
2. A **Production já tem o banco quase inteiro** (migration 0026: brutos, transcrição com segmentos, momentos, cortes, feedback, DNA, legenda, auto-edit, edit decisions, b-roll, jobs, publicação, métricas, memória). **O que falta é o processamento**: os providers estão vazios e a tela é só cadastro manual.
3. O **ECHO OS tem outra Produção** (pipeline `os_cards` Ideia até Publicado, calendário, banco de ideias, cenas, setups, formatos), uma rota de **transcrição Whisper** (só texto, sem timecode) e **YouTube Data API por chave** (dados públicos). Os dois lados não conversam, a não ser por Inspiração para Ideia.
4. Existem **três noções de "projeto"**: `projetos` (Studio, agrupa assets), `producao_projetos` (Production) e `os_cards` (pipeline do OS). O plano liga as três, sem fundir e sem apagar nenhuma.
5. **Marca** existe pela metade: `memes.categoria` e `inspiracoes.marca` (iveasor/asor/aivil/geral). As outras bibliotecas não têm marca.
6. Há **5 problemas para corrigir antes de evoluir** (seção 3), sendo 2 de persistência: o bruto excluído deixa o arquivo de vídeo para trás, e projetos excluídos não aparecem na Lixeira.
7. O processamento pesado (FFmpeg, Whisper, detecção de cena) **não cabe na Vercel**. O caminho é um **worker local no seu PC**, o mesmo padrão que você já usa no import-worker e no radar:worker, lendo a fila `producao_jobs`, que já existe.
8. **Smart Cuts** sai de sinais combinados (fala, pico de áudio, troca de cena, risada, atividade do chat), sempre como `sugerido`. Só exporta o que você aprovar.
9. O **export** gera arquivos que o seu editor abre: FCP7 XML (Premiere e DaVinci), EDL, SRT e OTIO. Não estou propondo construir um editor de vídeo dentro do ECHO.
10. São 9 fases. Cada uma fecha com algo que você usa de verdade. A **Fase 0** corrige o que existe e cria os componentes base. A **Fase 1** traz a marca global, a navegação nova e a busca global.

---

## 2. O que já existe (inventário)

### 2.1 echo-memes (ECHO // ASSETS)

| Área | Rotas | Tabelas | Estado |
|---|---|---|---|
| Memes | `/` | `memes`, `memes_usos` | Completo: corte início/fim, emoção, momento, formato, risco, favorito, uso. Importação por perfil (worker) e por X. |
| Áudios | `/audios` | `audios`, `audios_usos` (sfx consolidado) | Completo: tipo automático, licença, clima, BPM, trend do Radar. |
| Visuais | `/visuais` | `visuais`, `visuais_usos` (overlays, transições, presets, templates consolidados; templates = filtro `tipo`) | Completo. |
| Fontes, Brand, Paletas | `/fontes`, `/brand`, `/paletas` | `fontes`, `brand_assets`, `paletas` | Básico, via `AssetLibrary` genérico. Sem preview real de fonte e sem paleta com cores como dado. |
| Contas | `/contas` | `import_sources`, `import_runs`, `import_items` | Sincronização incremental por worker local (yt-dlp + Playwright). |
| Edits | `/edicoes` | `edicoes_referencia`, `edicoes_timestamps` (+ `shots`, `hooks` sem tela) | Timecodes e características (hook, ritmo, legenda, zoom...). |
| Inspirações | `/inspiracoes` | `inspiracoes` (+ `marca`, `ideia_id` para `os_ideias`) | Vira ideia no ECHO OS. |
| Refs | `/refs` | `echo_radar_criadores` (só o vínculo; os dados ficam no Radar) | Ok. |
| Projetos | `/projetos`, `/projetos/[id]` | `projetos`, `projeto_itens` (papel: referência/planejado/usado) | Ok. Exclusão é soft-delete. |
| Production | `/production`, `/production/[id]` | 20 tabelas `producao_*` | Banco completo, tela manual, nada processa. |
| Editing DNA | `/editing-dna` | `producao_editing_dna`, `_dna_regras`, `_dna_referencias`, `_dna_auto_edit`, `_legenda_presets` | Regras em texto livre + números de auto-edit. O preset de legenda não tem tela. |
| Analytics | `/analytics` | `producao_publicacoes`, `producao_metricas` | Snapshot digitado à mão. |
| Lixeira | `/lixeira` | `excluido_em` em 8 tabelas | Restaurar e excluir de vez (Storage primeiro). |
| Segurança | middleware, `/api/auth/*` | `api_rate_limits`, `audit_log` | Login no servidor, acesso por área (`app_metadata.espacos` contém "assets"), Turnstile, CSP. |

Componentes reaproveitáveis: `AssetLibrary` (config por tabela: campos, filtros, usos, upload, gaveta), `EditableField`, `Modal`, `EmptyState`, `Card`, `ToastProvider`, `storage.ts` (URLs assinadas em lote), `apiGuard` e `rotaSegura`.

### 2.2 echo-os-app- (ECHO OS), só o que encosta no Creator OS

- **Produção**: `os_cards` (estágios Ideia, Roteiro, Pronto para gravar, Gravado, Edição, Revisão, Agendado, Publicado), `os_card_cenas`, `os_card_comentarios`, `os_ideias`, `os_cenas`, `os_setups`, `os_equipamentos`, `os_formatos` e variações, `os_vlogs`, calendário de eventos (gravação, edição, publicação).
- **Análises e Crescimento**: `YoutubePanel` (`/api/youtube-stats`, chave pública), Spotify, `os_crescimento`.
- **Radar**: criadores, perfis, conteúdos, sincronização diária, providers YouTube, TikTok e Instagram.
- **`/api/transcribe`**: Whisper-1 da OpenAI, 10 chamadas por hora, devolve **só o texto** (sem segmentos).

### 2.3 Consequência para a arquitetura

O ECHO OS cuida do **planejamento** (o que gravar, quando, para qual formato). O Creator OS cuida do **material** (brutos, cortes, assets, presets, entrega). A ligação é feita por chave estrangeira, sem copiar dado:
`producao_projetos.os_card_id` aponta para `os_cards`, e o card do pipeline mostra "material no Creator OS".

---

## 3. O que precisa ser corrigido antes de evoluir

| # | Problema | Onde | Impacto | Correção |
|---|---|---|---|---|
| C1 | Excluir bruto apaga só a linha. O vídeo continua no bucket `producao-raw`, mas o aviso diz que "o arquivo original some do Storage". | `lib/production/data.ts` `excluirBruto` | Arquivo órfão (custo) e texto que não corresponde ao que acontece. | Soft-delete com `excluido_em`, Lixeira e exclusão definitiva com o Storage primeiro, como já é feito em `lixeira.ts`. |
| C2 | Projetos (`projetos`) usam soft-delete, mas não estão em `TABELAS_COM_LIXEIRA`. Nada restaura. `producao_projetos`, momentos, cortes e DNA são apagados de vez. | `lib/lixeira.ts`, `data.ts` | Perda sem volta com um clique. | `excluido_em` nas tabelas de Production e DNA, e todas elas na Lixeira. |
| C3 | Os campos de momento (`start_ms`, `end_ms`) gravam no banco a **cada tecla** (`onChange`) e pedem milissegundos crus. | `production/[id]` `AbaMomentos` | Muitas gravações seguidas e uso ruim. | Entrada em `mm:ss`, gravação no `blur` ou Enter, marcação direto no player. |
| C4 | Consultas N+1: Analytics busca métricas uma publicação por vez. A página do projeto carrega **todos** os projetos para achar um. | `analytics/page.tsx`, `production/[id]` | Fica lento quando o acervo cresce. | Uma consulta com `in(...)` ou uma view `producao_ultima_metrica`, e `select ... eq(id)`. |
| C5 | Emojis nas categorias de momento e status em inglês exibidos crus (`draft`, `queued`). | `production/[id]` | Foge do padrão (ícones lucide, texto pt-BR). | Mapa de rótulos e ícones lucide. |

Também anotado, sem urgência: upload de bruto pelo navegador com limite de 500 MB e upload simples (sem retomada), que não serve para live ou gameplay de vários GB (resolvido na Fase 2). Não existe nenhum teste automatizado no `echo-memes` (resolvido na Fase 0).

---

## 4. Arquitetura proposta

### 4.1 Onde o Creator OS mora

**Recomendação:** o `echo-memes` evolui para ECHO Creator OS, no mesmo deploy e com as mesmas URLs, que continuam funcionando. O ECHO OS continua sendo o planejamento. Eles se ligam por vínculo no banco (seção 2.3) e por links entre os sistemas, que já existem. Motivo: mover 18 telas e ~50 tabelas para o outro app é a mudança mais arriscada possível e não traz função nova.

### 4.2 Navegação (todas as rotas atuais preservadas)

| Grupo | Itens | Rotas |
|---|---|---|
| **Visão Geral** | Hoje: sessões a processar, cortes aguardando revisão, publicações da semana, jobs com erro | `/inicio` (nova) |
| **Produção** | Sessões, Projetos de produção, Revisão, Calendário | `/production`, `/production/[id]`, `/producao/sessoes` (nova), `/producao/revisao` (nova), `/producao/calendario` (nova) |
| **Biblioteca** | Memes, Áudios, Visuais, Fontes, Brand Assets, Paletas | iguais |
| **Referências** | Contas, Edits, Inspirações, Refs, Estudos | iguais + `/estudos` (nova, Fase 8) |
| **Studio** | Projetos (container de assets), Editing DNA e Presets, Pacotes de edição | `/projetos`, `/editing-dna`, `/pacotes` (nova) |
| **Inteligência** | Analytics, Busca em vídeos, Smart Cuts, Assist | `/analytics`, `/busca` (nova), `/assist` (doc 2) |
| **Sistema** | Lixeira, Integrações, Jobs e logs, Configurações | `/lixeira`, `/sistema/integracoes`, `/sistema/jobs` (novas) |

### 4.3 Seletor global de marca

- Tabela nova `marcas` (`id`, `user_id`, `slug`, `nome`, `cor`, `ordem`), com seed `iveasor` e `asor_lab`.
- Coluna nova **`marca_slug text null`** em memes, áudios, visuais, fontes, brand_assets, paletas, inspirações, edições, projetos, producao_projetos, sessões e DNA. **`null` significa compartilhado**: aparece em todas as marcas.
- Backfill sem perder nada: `memes.categoria` `iveasor` vira `iveasor` e `asor` vira `asor_lab`. `inspiracoes.marca` faz o mesmo. As colunas antigas **ficam** e o código antigo continua lendo delas.
- O seletor (IveASOR, ASOR.LAB, Todas) fica no topo, guardado na URL (`?marca=`) e no localStorage. Em "Todas", cada card mostra um selo da marca.
- Separação: projetos, identidade (fontes, paletas, brand) e métricas sempre filtram pela marca. Áudios, memes e visuais podem ser compartilhados (marca `null`).
- **Decisão sua:** o valor `aivil`, que já existe em memes e inspirações, vira uma terceira marca no seletor ou fica só como etiqueta?

### 4.4 Relacionamentos e histórico de uso

Já existem `projeto_itens`, `producao_dna_referencias`, `producao_derivados` (`tabela_asset` + `asset_id`) e `*_usos`. Em vez de uma tabela genérica nova, a proposta é uma **view `echo_usos_unificados`** que junta essas tabelas. A gaveta de qualquer asset ganha a aba "Onde foi usado" (projetos, cortes, DNA). As tabelas novas seguem o mesmo par `tabela_origem` + `item_id`, com RLS de posse (padrão das migrations 0027 a 0029).

### 4.5 Busca global

- Fase 1: `Ctrl+K` busca por título e tags em todas as bibliotecas, referências, projetos e sessões, usando Postgres full-text (`tsvector` com dicionário `portuguese`) e um índice GIN por tabela. Uma RPC `buscar_global(termo, marca, tipos[])` com `security invoker`, então a RLS continua valendo.
- Fase 3: inclui os trechos de transcrição (o resultado abre o vídeo no segundo exato).
- Fase 9: busca semântica com **pgvector** (suportado nativamente no Supabase) sobre segmentos de transcrição e descrições de asset. Só entra se a busca por texto não bastar no uso real.

### 4.6 Processamento: fila e worker

```
navegador ──upload──► Storage (proxy) / PC (original)
     │
     └─► producao_jobs (fila no Postgres, já existe)
              ▲   │ reivindicar_job()  (for update skip locked)
              │   ▼
         ECHO Worker local (PC)  ── ffprobe, ffmpeg, faster-whisper, PySceneDetect
              │
              └─► grava resultados (segmentos, momentos, derivados) + log + status
```

- **Colunas novas em `producao_jobs`**: `tentativas`, `max_tentativas` (3), `proximo_em` (backoff de 1, 5 e 30 min), `worker_id`, `heartbeat_em`, `payload jsonb`, `resultado jsonb`, `custo_estimado`.
- **RPCs**: `reivindicar_job(tipos text[], worker text)`, `heartbeat_job(id)`, `concluir_job(id, resultado)`, `falhar_job(id, erro)`. Job sem heartbeat por 15 min volta para a fila (o mesmo critério do import-worker).
- **Tabela `producao_job_logs`** (job_id, nível, mensagem, em), exibida em `/sistema/jobs`.
- **Credenciais**: o worker usa a chave secreta só no `.env.local` do PC (como hoje). O navegador nunca recebe chave.
- **Por que local**: a Vercel tem limite de corpo e de tempo de função, e transcrever ou gerar proxy de 2 h de live leva minutos. O PC já roda dois workers seus. Risco: o PC precisa estar ligado. A fila espera e nada se perde.

### 4.7 Onde ficam os arquivos brutos

**Recomendação:** o original fica no PC (ou no Drive), e o Supabase recebe **só o proxy** (720p, bitrate baixo) e as miniaturas. Uma live de 3 h em 1080p passa de 5 GB, e guardar isso no Storage custa caro e é lento. O bruto guarda `caminho_local` + `hash` (assim dá para achar duplicatas e reencontrar o arquivo se ele mudar de pasta). O render final dos cortes aprovados roda no worker, a partir do original.

---

## 5. Produção audiovisual: como cada item vira funcionalidade

| Pedido | Existe | Falta | Fase |
|---|---|---|---|
| Sessões de gravação e brutos | `producao_brutos` | `producao_sessoes` (data, marca, tipo: live, gameplay, vlog, 3D, bastidor; plataforma; série; notas) com brutos ligados. Pasta vigiada no PC que cria a sessão sozinha. | 2 |
| Ingestão, metadados, proxies | colunas de duração e tamanho | Job `ingest`: ffprobe (duração, resolução, fps, codec, áudio), proxy 720p, tira de miniaturas, forma de onda, hash. | 2 |
| Transcrição com timecodes e busca | `producao_transcricoes`, `_segmentos` | Job `transcribe` com faster-whisper (palavras com timestamp, VAD). Player com transcrição clicável. Busca dentro do vídeo. | 3 |
| Marcadores e seleção de cortes | `producao_momentos`, `producao_clips` | Player com atalhos (`M` marca, `I`/`O` entrada e saída, `J`/`K`/`L`), linha do tempo com marcadores, momento aprovado vira corte em um clique. | 4 |
| Shorts e vídeos longos | `formato`, `aspect_ratio` | Preparação 9:16 (indicação de enquadramento), duração alvo por plataforma, legendas queimadas opcionais. Longo: lista de capítulos a partir dos momentos. | 4 |
| Pacotes de edição | DNA, legenda preset (sem tela) | `/pacotes`: pasta ou zip com proxy ou original, SRT, XML da timeline, assets do projeto, fontes, LUT, checklist do DNA. | 5 |
| Versões, revisão e aprovação | `producao_derivados.versao`, feedback | Fluxo `rascunho → revisão → aprovado → exportado`, comparação entre versões, feedback com timecode, aprovação em lote. | 6 |
| Calendário editorial e publicação | `producao_publicacoes`; calendário em `os_cards` | Calendário que lê `os_cards` + publicações (sem duplicar), checklist de publicação por plataforma (título, descrição, tags, thumb, legenda). | 6 |
| Histórico de recursos por projeto | `projeto_itens`, derivados | Aba "Recursos usados", que alimenta o "Onde foi usado" de cada asset. | 1 e 5 |

### 5.1 Smart Cuts (estudo)

- **Sinais**: (a) transcrição: frases de gancho, perguntas, palavras-chave da série; (b) áudio: picos de volume e risada (ffmpeg `ebur128` e `silencedetect`); (c) imagem: troca de cena (PySceneDetect); (d) **Twitch**: clipes criados durante a live trazem `vod_offset`, e momentos em que o chat explode (quando houver dado autorizado); (e) seus próprios marcadores e o feedback de cortes anteriores (`producao_feedbacks`: "cortou cedo", "hook fraco").
- **Saída**: `producao_momentos` com `status = sugerido`, `score` e **`reason` legível** ("pico de risada + frase de gancho em 12:41"). Já existe no banco.
- **Regra fixa**: nada é exportado ou publicado a partir de uma sugestão. O corte só nasce de momento `aprovado`. A tela separa visualmente o que é sugestão do que você confirmou.
- **Medida de qualidade**: a taxa de sugestões aprovadas por sessão aparece em Sistema. Se ficar baixa, os pesos são ajustados.

### 5.2 Export para o seu editor

| Formato | Para | Como |
|---|---|---|
| FCP7 XML | Premiere e DaVinci Resolve (ambos importam) | adapter `fcp_xml` do OpenTimelineIO-Plugins |
| EDL (CMX3600) | qualquer NLE | adapter `cmx_3600` |
| OTIO JSON | formato neutro, guardado como versão | OTIO nativo |
| SRT / VTT | legendas | gerado dos segmentos |
| MP4 do corte | prévia e Shorts simples | ffmpeg no worker |

---

## 6. Biblioteca e Editing DNA

### 6.1 Biblioteca (melhorias comuns, via `AssetLibrary`)

- Visualizações: **grade** (padrão para visual e meme), **lista** (áudio, fonte), **tabela** (edição em lote). Um componente `ViewSwitcher` guarda a escolha por biblioteca.
- **Ações em lote**: marcar vários itens para mudar marca e tags, favoritar, mandar para a Lixeira ou adicionar a projeto.
- **Licença**: hoje só áudio tem. Entra em visuais, fontes e memes (`licenca`, `fonte_licenca`, `atribuicao`) com filtro "seguro para monetizar".
- **Duplicatas**: hash SHA-256 no upload (coluna `hash_arquivo`). Ao subir um arquivo repetido, o ECHO avisa e oferece abrir o que já existe. Para itens antigos, um job de backfill.
- **Previews**: fonte renderizada com texto de amostra, paleta como cores reais (`cores jsonb`), áudio com forma de onda, vídeo com hover-scrub.
- **Histórico de uso**: a aba "Onde foi usado" (seção 4.4).

### 6.2 Editing DNA vira sistema de presets

- O DNA atual vira **Preset**, com escopo: `marca`, `plataforma` (YouTube longo, Shorts, TikTok, Twitch highlight), `serie`, `tipo_conteudo`. Colunas novas em `producao_editing_dna`: `marca_slug`, `plataforma`, `serie`, `tipo_conteudo`, `herda_de` (preset pai).
- **Herança**: "IveASOR base" define fontes, paleta e brand. "IveASOR gameplay Shorts" herda e muda só ritmo, legenda e 9:16. A tela mostra o que é herdado e o que foi sobrescrito.
- **Conteúdo do preset**: regras (já existem), auto-edit (já existe), legenda (tabela existe, ganha tela com prévia), fontes, paleta, brand assets, SFX e trilhas padrão (vínculos com a biblioteca), checklist de publicação.
- **Novo projeto já preparado**: ao criar um projeto de produção escolhendo marca, plataforma e série, o ECHO sugere o preset mais específico, e um clique aplica (cria os `projeto_itens` com papel `planejado`). Você não monta nada à mão, e cada aplicação pode ser desfeita.
- **Exportável**: o preset gera o arquivo de legenda e a lista de assets que entram no pacote (Fase 5).

---

## 7. Referências e estudos

- **Conexão**: uma Conta (fonte importada) leva aos itens que trouxe. Um Edit se liga a uma Ref (criador do Radar), e uma Inspiração se liga a Edits. Essas ligações usam colunas `*_id` opcionais. Hoje cada tela é isolada.
- **Estudo de referência** (`/estudos`): pega um Edit, marca timecodes (`edicoes_timestamps`, já existe) com técnica (`caracteristicas`, já existe, mais `shots` e `hooks`, que já têm tabela sem tela) e gera uma **estrutura** do vídeo (gancho, desenvolvimento, virada, fecho, com tempos).
- **Transformar**: "virar preset" copia as técnicas para regras do DNA. "virar projeto" cria `producao_projetos` com a estrutura como roteiro e o card no pipeline do OS.
- **Importação autorizada**: link + metadados por API oficial (YouTube Data API, Display API do TikTok para a **sua** conta), embed para assistir, e upload do que é seu. **Risco a registrar**: o import-worker atual baixa vídeos de terceiros com yt-dlp, o que entra em conflito com os termos das plataformas. O plano **não remove** essa função (regra de preservação), mas também **não a expande**. As funções novas usam só os caminhos oficiais.

---

## 8. APIs e integrações (documentação oficial lida em 15/10/2026)

| Plataforma | Dá para fazer | Não dá / condição | Uso no ECHO |
|---|---|---|---|
| **YouTube Data API v3** | OAuth: upload (`youtube.upload`), `publishAt` para agendar, título, descrição, thumbnail, legendas, playlists. Push de vídeo novo (PubSubHubbub). | Cota diária por projeto. A doc de hoje diz 10.000 unidades + baldes próprios para upload e busca, e que projetos não verificados já não sobem só como privado. **Isso mudou recentemente: conferir no console antes de depender.** | Publicar ou agendar a partir da checklist. Sincronizar vídeos publicados com `producao_publicacoes`. |
| **YouTube Analytics / Reporting** | Métricas do seu canal (`yt-analytics.readonly`). Reporting para relatórios em massa. | App público exige verificação do Google. Uso pessoal em modo teste funciona. | Substituir o snapshot manual em Analytics, com sincronização diária incremental. |
| **Twitch** | VODs, highlights e clipes (com `vod_offset`). Criar clipe durante a live (`clips:edit`). EventSub `stream.online` e `stream.offline` por webhook. | **Não existe endpoint para baixar o VOD.** O VOD comum expira em 14 dias. | Live começou: cria a sessão. Live acabou: lembra de importar o arquivo gravado localmente (OBS). Clipes viram momentos sugeridos. |
| **TikTok** | Display API: os seus vídeos e métricas básicas. Content Posting: enviar para a caixa de rascunhos (`video.upload`). | Direct Post de cliente não auditado sai **privado**. Research API não é para uso individual ou comercial. Não achei webhooks. | Mandar o corte aprovado para os rascunhos do TikTok. Você finaliza no app. |
| **Discord** | Webhook de entrada sem bot: mensagem, embed, arquivo. | Bot completo só se precisar ler mensagens (não é necessário agora). | Avisos: "sessão transcrita", "3 cortes aguardando revisão", "publicado". |
| **Google Drive** | `drive.file` + Picker: só os arquivos que você escolher (verificação simples). `changes.watch` com renovação manual. | O escopo `drive` completo é restrito (exige auditoria de segurança). | Escolher brutos no Drive. O worker baixa e processa. |

**Infraestrutura comum das integrações**:
- `integracoes_contas` (plataforma, conta externa, escopos, `token_cifrado` guardado no **Supabase Vault**, expira_em, status) e `integracoes_sync` (cursor incremental, último sucesso, último erro).
- Tokens **só no servidor**. Refresh automático. Revogar em `/sistema/integracoes` apaga o token.
- Webhooks em `/api/webhooks/{twitch,youtube}` com verificação de assinatura (HMAC da Twitch, challenge do PubSubHubbub) e idempotência por id de evento.
- Toda chamada externa passa pela fila com retentativa e backoff, fica registrada em log e conta cota.

---

## 9. Tecnologias avaliadas

| Tecnologia | Licença | Maturidade | Benefício concreto | Risco | Esforço | Decisão |
|---|---|---|---|---|---|---|
| **FFmpeg** | LGPL 2.1+ (GPL se usar partes GPL, como libx264) | Muito madura | Metadados, proxy, miniaturas, forma de onda, silêncio, loudness, render dos cortes | Licença: usar o binário como **processo externo** (sem linkar) e distribuir nada. Uso pessoal no PC, sem questão prática. | Baixo | **Usar** (Fase 2) |
| **faster-whisper** | MIT | Madura (1.2.x) | Timestamps por palavra, VAD, até 4x mais rápido que o Whisper original, roda local | Precisa de GPU NVIDIA para ser rápido. Em CPU funciona, mais devagar. | Baixo | **Usar** (Fase 3) |
| Whisper (OpenAI, local) | MIT | Madura | Referência de qualidade | Mais lento que o faster-whisper | Baixo | Alternativa |
| whisper.cpp | MIT | Madura (1.9.x). Timestamp por palavra é experimental. | Servidor HTTP próprio, CPU ou Vulkan | Timestamp por palavra instável | Médio | Plano B sem Python |
| Whisper API (OpenAI) | serviço pago | Já usado no ECHO OS | Sem GPU local | Custo por minuto, limite de arquivo, áudio sai do PC | Baixo | Plano B para áudios curtos |
| **PySceneDetect** | BSD-3 | 0.7.x, ativa | Troca de cena para Smart Cuts e capítulos | Pouco útil em gameplay com câmera fixa | Baixo | **Usar** (Fase 4) |
| **OpenTimelineIO** | Apache-2.0 | API estável. Adapters em pacote separado (OpenTimelineIO-Plugins). | Export FCP7 XML e EDL para Premiere e DaVinci | Sem adapter nativo do Resolve (usa XML) | Médio | **Usar** (Fase 4) |
| **pgvector** | licença estilo PostgreSQL | 0.8.x, nativo no Supabase | Busca semântica em transcrições | Custo dos embeddings, tamanho do índice | Médio | Fase 9, se a busca por texto não bastar |
| **Remotion** | licença própria (não é open source). Grátis para pessoa física e empresa com até 3 pessoas. | Muito ativa (4.0.x) | Templates de vídeo em React (intro, legenda animada, card de thumbnail) | Muda na versão 5.0. Se o ASOR.LAB passar de 3 pessoas, precisa de licença paga. | Médio | Avaliar na Fase 5, só para templates |
| **FilmCraft** (ArtCraft) | MIT ou Apache-2.0 | **Alpha** ("56% pronto para trabalho real") | Editor não-linear em Rust com CLI, controle JSON e servidor MCP | Protótipo. Não usar em produção. | Alto | Observar. Um teste de CLI headless na Fase 9 no máximo |
| PhotoCraft | MIT ou Apache-2.0 | early alpha | Edição de imagem por CLI e MCP (thumbnails em lote) | Alpha | Médio | Observar |
| SoundCraft | MIT ou Apache-2.0 | pré-alpha | DAW com bounce headless | Pré-alpha | Alto | Não usar |
| EffectCraft, LightCraft, VectorCraft, GridCraft, FigCraft | Apache-2.0 (listado) | "em desenvolvimento" ou early alpha | Motion, raw, vetor, planilha, UI | Não verificados a fundo | n/a | Não usar agora |
| ArtCraft (núcleo) | MIT ou Apache-2.0 | Desktop | Geração de imagem e vídeo | **Depende de modelos pagos na nuvem** (Kling, Veo, Midjourney etc.) | n/a | Fora do escopo |

Regra: nenhum código de terceiros é copiado para o repositório. Tudo entra como dependência ou programa externo, com a licença registrada em `docs/licencas.md`.

---

## 10. UI/UX

**Diretriz** (vale para toda tela nova): fundo escuro do ECHO, destaque teal, ícones lucide e nada de emoji, texto em pt-BR sem travessão, visual editorial e denso, nada de dashboard genérico.

- **Tokens**: escala de tipografia fixa (11/13/15/18/24), espaçamento em múltiplos de 4, contraste AA (texto secundário `neutral-400` sobre `neutral-950`, nunca `neutral-600` para texto que precisa ser lido).
- **Componentes base (Fase 0)**: `ViewSwitcher`, `FilterBar` (chips + busca + "limpar"), `Gaveta` (painel contextual à direita, no desktop sem sair da lista), `BulkBar` (aparece quando você seleciona itens), `EstadoVazio` (uma frase e uma ação, sem área vazia enorme), `Timecode` (entrada `mm:ss`), `PlayerComMarcadores`, `SeloMarca`, `StatusJob`.
- **Desktop**: atalhos (`Ctrl+K` busca, `/` filtra, `J`/`K`/`L` e `M` no player, `A` aprova, `X` descarta na revisão), seleção com Shift, painel contextual.
- **Mobile**: Visão Geral (o que precisa de você), **captura rápida** de referência (colar link ou compartilhar do app para o ECHO, via PWA share target), revisão de cortes em tela cheia com aprovar e descartar por toque, acompanhamento de jobs. A edição pesada não vai para o celular.
- **Visão Geral sem número inútil**: só itens que pedem ação (revisar, processar, publicar, erro) e a próxima publicação. Sem contadores decorativos.
- **Acessibilidade**: foco visível, `aria-*` em grupos e abas (o padrão já está na Sidebar), alvos de 40 px ou mais, player navegável por teclado.

---

## 11. Plano por fases

Convenção: toda migration é **aditiva** (`add column if not exists`, tabela nova, policy recriada com `drop policy if exists`), roda inteira no SQL Editor e não apaga nem altera dado existente. As migrations continuam a série do `echo-memes` (0031 em diante), lembrando que o banco é o mesmo do ECHO OS (que está na 0136). Cada fase termina com teste automatizado, teste manual em **conta de teste descartável** (nunca na sua), um commit e um deploy.

### Fase 0: correções e base (1 rodada)
- C1 a C5 da seção 3.
- `excluido_em` em `producao_brutos`, `producao_projetos`, `producao_momentos`, `producao_clips` e `producao_editing_dna`. Todas essas tabelas e `projetos` entram na Lixeira.
- Testes: copiar a estrutura de testes do ECHO OS (`node --test` + `_registrar.mjs`) e cobrir lixeira, timecode e mapeamentos.
- Componentes base da seção 10.
- **Banco**: migration 0031 (só colunas `excluido_em` e índices).
- **Aceite**: excluir um bruto manda para a Lixeira. Restaurar volta. Excluir de vez remove o arquivo do bucket. Projetos excluídos aparecem na Lixeira. Momento aceita `12:41`.

### Fase 1: marca, navegação, busca global, relacionamentos
- Tabela `marcas`, `marca_slug` nas tabelas listadas e backfill (seção 4.3). Seletor global.
- Sidebar com os 7 grupos. `/inicio` (Visão Geral).
- `Ctrl+K` com a RPC `buscar_global`.
- View `echo_usos_unificados` e a aba "Onde foi usado".
- `producao_projetos.os_card_id` (vínculo com o pipeline do OS).
- **Contratos**: `rpc buscar_global(termo text, marca text, tipos text[], limite int) returns table(tabela, id, titulo, trecho, marca_slug, url_arquivo)`.
- **Aceite**: com "ASOR.LAB" selecionado, nenhuma tela mostra projeto ou fonte da IveASOR. Os itens com marca vazia aparecem nas duas. Todas as rotas antigas abrem. A busca acha um meme pelo título em menos de 300 ms com 5 mil itens.

### Fase 2: sessões e ingestão (worker local)
- `producao_sessoes`. Bruto ganha `sessao_id`, `caminho_local`, `hash`, `proxy_url`, `metadados jsonb`.
- Fila: colunas e RPCs da seção 4.6, `producao_job_logs`, tela `/sistema/jobs`.
- `echo-worker` (Node, no `scripts/`, mesmo padrão do import-worker com `--once`): jobs `ingest` (ffprobe, proxy, miniaturas, forma de onda, hash) e pasta vigiada.
- Upload pelo navegador com retomada (TUS do Supabase Storage) para arquivos médios.
- **Aceite**: soltar um MP4 de 4 GB na pasta vigiada cria a sessão e o bruto, gera o proxy e o player toca o proxy no ECHO. Matar o worker no meio faz o job voltar para a fila e terminar depois.

### Fase 3: transcrição e busca dentro dos vídeos
- Job `transcribe` (faster-whisper, pt, palavras com timestamp) grava em `producao_transcricao_segmentos` (+ `palavras jsonb`).
- Player com transcrição sincronizada. Clicar na frase pula para o tempo. Busca dentro do vídeo. Os segmentos entram na busca global.
- Export SRT e VTT.
- **Aceite**: uma sessão de 1 h é transcrita sem intervenção. Buscar uma frase falada leva ao segundo certo (com até 1 s de erro).

### Fase 4: momentos, Smart Cuts, cortes, export
- Player com marcadores e atalhos. Momento aprovado vira corte.
- Job `detect_moments` (sinais da seção 5.1) gera sugestões com motivo.
- Job `render_clip` (ffmpeg, a partir do original). Export FCP7 XML, EDL e OTIO.
- Preparação para Shorts e longo (duração alvo, 9:16, capítulos).
- **Aceite**: abrir o XML exportado no DaVinci e no Premiere mostra os cortes nos tempos certos. Nenhuma sugestão vira arquivo sem aprovação (coberto por teste).

### Fase 5: presets e pacotes de edição
- Escopo e herança do DNA. Tela do preset de legenda com prévia. Vínculos de fonte, paleta, brand e SFX.
- "Novo projeto" aplica o preset. `/pacotes` gera o pacote (zip ou pasta local pelo worker).
- Avaliar Remotion para 1 template (intro ou legenda animada).
- **Aceite**: criar "IveASOR / Shorts / gameplay" já traz fontes, legenda, paleta e SFX ligados. O pacote abre no editor com tudo no lugar.

### Fase 6: versões, revisão, calendário, publicação
- Versões de corte (derivados), revisão em lote (desktop e mobile), feedback com timecode.
- Calendário que lê `os_cards` + publicações. Checklist de publicação por plataforma.
- **Aceite**: revisar 10 cortes pelo celular em menos de 2 minutos. A publicação agendada aparece no calendário do ECHO OS sem cadastro duplo.

### Fase 7: integrações
- Ordem por benefício: (1) Discord webhook, (2) YouTube OAuth (publicar, agendar, sincronizar publicações) + Analytics, (3) Twitch EventSub + clipes, (4) TikTok (rascunhos + Display), (5) Drive Picker.
- Infra da seção 8 (Vault, sync incremental, webhooks assinados, logs, cota).
- **Aceite**: abrir uma live na Twitch cria a sessão sozinha. Publicar no YouTube a partir do ECHO grava a publicação e, no dia seguinte, as métricas chegam sem digitação. Revogar a integração apaga o token.

### Fase 8: referências conectadas e estudos
- Ligações Conta, Edit, Ref e Inspiração. `/estudos` com estrutura e técnicas. "Virar preset" e "virar projeto".
- **Aceite**: um Edit estudado vira preset e projeto em 2 cliques, com os timecodes preservados.

### Fase 9: inteligência e ECHO Assist
- Busca semântica (pgvector) se fizer falta. Explicação de métricas. Sugestões de título.
- O Assist é planejado no **documento 2** (ECHO // TEAM), que trata agentes, permissões, aprovação humana e custos para os dois sistemas.

### Dependências

```
F0 ─► F1 ─► F2 ─► F3 ─► F4 ─► F6
             │            └─► F5
             └──────────────► F7 (Discord pode vir já depois da F1)
F1 ─► F8
F3 + F4 + F7 ─► F9
```

---

## 12. Riscos principais

| Risco | Mitigação |
|---|---|
| Custo e tamanho de Storage com vídeo | Original no PC ou Drive, proxy na nuvem, limpeza de proxy de sessão arquivada |
| PC desligado = fila parada | A fila é persistente, a Visão Geral mostra "worker offline há X h", e nada se perde |
| GPU desconhecida (velocidade do Whisper) | Medir na Fase 3 com modelos `small` e `medium`. Plano B: whisper.cpp ou a API da OpenAI para áudio curto |
| Cotas e auditorias (Google, TikTok) | Uso pessoal em modo teste, cota medida em log, TikTok via rascunho |
| Termos de uso (download de terceiros) | Nada novo baixa conteúdo de terceiros. O worker antigo fica como está, com o risco registrado |
| Banco compartilhado com o ECHO OS | Prefixos de tabela, migrations aditivas, rodar a varredura de migrations faltando antes de cada fase |
| Mudança de licença (Remotion 5, FFmpeg com GPL) | Registro em `docs/licencas.md` e revisão a cada versão |

---

## 13. Decisões que dependem de você

1. **Creator OS = evolução do `echo-memes`** (recomendado), mantendo o ECHO OS como planejamento. Ou você prefere juntar tudo no ECHO OS?
2. **Brutos originais no PC (ou Drive) e só proxy na nuvem** (recomendado)?
3. **`aivil`** vira uma terceira marca no seletor ou fica só como etiqueta?
4. Seu PC tem placa NVIDIA? Isso define o modelo do Whisper na Fase 3.
5. Começar pela **Fase 0** (correções, sem mudar nada visível além dos bugs)?
