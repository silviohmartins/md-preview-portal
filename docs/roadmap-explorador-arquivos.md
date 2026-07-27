# Roadmap: Explorador de arquivos locais

> **Status:** adiado — retomar quando priorizar workspace multi-arquivo.  
> **Contexto:** análise de produto/arquitetura (jul/2026). A caneta (glass overlay) já foi entregue e é independente.

## Objetivo

Permitir selecionar um diretório local, listar arquivos Markdown e editar/visualizar no mdstudio.io, com salvar de volta no disco — sem enviar conteúdo ao servidor.

## Por que está adiado

Escopo maior que a caneta: exige refactor do modelo de documento único (`useMarkdownDraft` + `localStorage` `md-draft`) para um **workspace** com múltiplos arquivos, dirty state e File System Access API.

## Decisões recomendadas (quando retomar)

| Tema | Escolha sugerida |
|------|------------------|
| API | File System Access API (`showDirectoryPicker` + handles) |
| Fallback | `input webkitdirectory` (leitura limitada; avisar browsers sem FS Access) |
| Persistência de pasta | IndexedDB para handles + metadados; permissão pode ser revogada |
| Draft atual | Manter `localStorage` para “documento avulso” sem pasta aberta |
| Anotações | Migrar key de hash de conteúdo → `filePath` (melhor UX) |
| Deploy Docker | Sem impacto — 100% client-side |

## Arquitetura alvo

```
UI: FileTree | Editor (CodeMirror) | Preview
         ↓
useWorkspace() — activeFile, files[], dirty, save/open
         ↓
FileSystemPort (interface)
  ├─ BrowserFSAccessAdapter
  └─ LegacyPickerAdapter
         ↓
IndexedDB: directory handles + per-file metadata
```

**Patterns:** Port/Adapter (testável por agentes), Repository de `FileEntry`, Command para Save/OpenFolder (Ctrl+S).

## MVP enxuto

1. Botão “Abrir pasta” → listar `.md` (começar com 1 nível ou recursão simples).
2. Clique abre no editor; Ctrl+S grava via handle.
3. Guard de dirty ao trocar de arquivo.
4. Fallback degradado + aviso em browsers sem suporte.
5. Sem imagens relativas no MVP (ou só warning).

## Fora do MVP inicial

- `FileSystemObserver` / reload externo  
- Busca na árvore, recent files  
- Sidecar de anotações (`.md.annotations.json`)  
- Imagens relativas via blob URLs  

## Riscos e mitigações

| Risco | Mitigação |
|-------|-----------|
| Compatibilidade Firefox/Safari | Feature detect + fallback + mensagem clara |
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

- Abrir pasta e editar `.md` sem backend.
- Salvar grava no arquivo real (Chrome/Edge).
- Troca de arquivo com alterações pede confirmação ou salva.
- Preview/sanitize/PDF/caneta continuam funcionando.
- Documento sem pasta aberta ainda usa draft em `localStorage`.

## Como retomar

1. Abrir este arquivo e validar se as decisões ainda valem.
2. Modo Plan no Cursor: “implementar explorador conforme `docs/roadmap-explorador-arquivos.md`”.
3. Particionar em PRs: fundação `useWorkspace` → FS adapter → FileTree UI → wire Save → (opcional) anotações por path.
