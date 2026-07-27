# Roadmap: Explorador de arquivos locais

> **Status:** pronto para implementar — progressive enhancement (Chromium completo; Firefox/Safari degradado).  
> **Contexto:** análise de produto/arquitetura (jul/2026). A caneta (glass overlay) já foi entregue e é independente.

## Objetivo

Permitir selecionar um diretório local, listar arquivos Markdown e editar/visualizar no mdstudio.io, com salvar de volta no disco — sem enviar conteúdo ao servidor.

## Escopo arquitetural

Exige refactor do modelo de documento único (`useMarkdownDraft` + `localStorage` `md-draft`) para um **workspace** com múltiplos arquivos, dirty state e acesso a arquivos locais (nativo ou fallback).

## Compatibilidade de browsers (decisão fechada)

| Browser | Abrir pasta / listar `.md` | Salvar no mesmo arquivo | Reabrir pasta na próxima visita |
|---------|---------------------------|-------------------------|---------------------------------|
| Chrome / Edge | File System Access API | Sim (`createWritable`) | Handle no IndexedDB |
| Firefox | Fallback (`webkitdirectory`) | Não — “Salvar como…” / download | Não — usuário escolhe de novo |
| Safari | Fallback limitado | Não — download | Não |

**Por quê:** Firefox **não** implementa `showDirectoryPicker` / pickers de disco local (posição Mozilla: *harmful*). Só há OPFS (sandbox do origin), que **não** acessa pastas do usuário. Isso não deve mudar no curto prazo.

**Polyfill completo?** Não existe. Nenhuma lib inventa handles persistentes nem overwrite silencioso no Firefox.

**Biblioteca recomendada:** [`browser-fs-access`](https://github.com/GoogleChromeLabs/browser-fs-access) (Chrome Labs) — *ponyfill*, não polyfill:

- Chromium → API nativa  
- Firefox/Safari → `directoryOpen` / `fileOpen` / `fileSave` via `<input>` + download  

Tratar o explorador como **progressive enhancement**: UX completa no Chromium; no Firefox, abrir/editar + aviso claro de salvamento degradado.

## Decisões recomendadas

| Tema | Escolha |
|------|---------|
| API (Chromium) | File System Access API (`showDirectoryPicker` + handles) |
| Fallback / API unificada | `browser-fs-access` (`directoryOpen`, `fileSave`, etc.) |
| UX sem suporte nativo | Banner: “Neste browser o salvamento baixa uma cópia; no Chrome/Edge grava no arquivo original.” |
| Persistência de pasta | IndexedDB para handles (só onde a API nativa existir); permissão pode ser revogada |
| Draft atual | Manter `localStorage` para “documento avulso” sem pasta aberta |
| Anotações | Migrar key de hash de conteúdo → `filePath` (melhor UX); hash continua para avulsos |
| Deploy Docker | Sem impacto — 100% client-side |

## Arquitetura alvo

```
UI: FileTree | Editor (CodeMirror) | Preview
         ↓
useWorkspace() — activeFile, files[], dirty, save/open, capabilities
         ↓
FileSystemPort (interface)
  └─ BrowserFsAccessAdapter  (browser-fs-access + feature detect)
         ↓
IndexedDB: directory handles (Chromium) + per-file metadata
```

**Patterns:** Port/Adapter (testável por agentes), Repository de `FileEntry`, Command para Save/OpenFolder (Ctrl+S).

`capabilities` no workspace deve expor pelo menos: `canOverwriteInPlace`, `canPersistDirectoryHandle`.

## MVP enxuto

1. Botão “Abrir pasta” → listar `.md` (começar com 1 nível ou recursão simples via `directoryOpen`).
2. Clique abre no editor; Ctrl+S → overwrite nativo **ou** `fileSave`/download no fallback.
3. Guard de dirty ao trocar de arquivo.
4. Banner de capacidades quando `canOverwriteInPlace === false`.
5. Sem imagens relativas no MVP (ou só warning).

## Fora do MVP inicial

- `FileSystemObserver` / reload externo  
- Busca na árvore, recent files  
- Sidecar de anotações (`.md.annotations.json`)  
- Imagens relativas via blob URLs  
- Paridade total Firefox ↔ Chrome (impossível sem API nativa)

## Riscos e mitigações

| Risco | Mitigação |
|-------|-----------|
| Firefox/Safari sem FS Access | `browser-fs-access` + banner de UX degradada |
| Expectativa de “Salvar = mesmo arquivo” no Firefox | Copy clara na UI; não fingir paridade |
| XSS via `.md` externo | Manter pipeline atual (`rehype-sanitize`, sem HTML cru) |
| Sobrescrita acidental | Confirmar dirty; indicador no footer |
| Pastas grandes | Filtrar extensões; Worker opcional para indexar |
| Testes E2E da FS API | Mock de `FileSystemPort` no Vitest |

## Integração com anotações (já existentes)

Hoje strokes usam `md-annotations:{hash}`. Com explorador:

- Preferir `md-annotations:file:{relativePath}` (ou similar).
- Manter hash como fallback para documentos avulsos.

Não é bloqueante para o MVP do explorador.

## Critérios de aceite (quando implementar)

- Abrir pasta e editar `.md` sem backend (Chromium e Firefox com fallback).
- Salvar grava no arquivo real no Chrome/Edge; no Firefox dispara salvamento via download/`fileSave`.
- Troca de arquivo com alterações pede confirmação ou salva.
- Preview/sanitize/PDF/caneta continuam funcionando.
- Documento sem pasta aberta ainda usa draft em `localStorage`.
- Banner visível quando overwrite in-place não estiver disponível.

## Como retomar / implementar

1. Abrir este arquivo e validar se as decisões ainda valem.
2. Modo Plan no Cursor: “implementar explorador conforme `docs/roadmap-explorador-arquivos.md`”.
3. Particionar: fundação `useWorkspace` + `capabilities` → adapter `browser-fs-access` → FileTree UI → wire Save → banner fallback → (opcional) anotações por path.
