# mdstudio.io

Editor Markdown com preview ao vivo — Next.js + CodeMirror + remark/rehype.

## Funcionalidades

- **Editor** com syntax highlight (CodeMirror 6)
- **Explorador de arquivos** — abrir pasta local, listar `.md`, editar e salvar (Chrome/Edge grava no arquivo; Firefox/Safari baixam uma cópia). Painel lateral recolhível
- **Draft avulso** — sem pasta aberta, auto-save em `localStorage` (`md-draft`)
- **Preview** ao vivo com GFM, tabelas, task lists e syntax highlight (Shiki)
- **Copiar** — botão no painel Editor copia o markdown bruto para a área de transferência
- **Exportar PDF** — botão no painel Preview baixa o conteúdo formatado como `mdstudio.io.pdf`
- **Tema** claro/escuro e preview expandido em overlay
- **Sync scroll** — alinha o scroll do editor e do preview (toggle na toolbar / ícone do editor)
- **Anotações (caneta)** — no preview expandido, camada de “vidro” para desenhar marcações sem alterar o markdown (caneta, marcador, borracha, undo/redo); persistidas em `localStorage` por hash do conteúdo

## Desenvolvimento

```bash
npm install
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000).

## Testes

```bash
npm test          # Vitest (unit)
npm run test:e2e  # Playwright (E2E)
```

## Deploy (Coolify / Docker)

```bash
docker build -t mdstudio.io .
docker run -p 3000:3000 mdstudio.io
```

Healthcheck: `GET /api/health` → `{ "status": "ok" }`

O explorador de arquivos é 100% client-side (File System Access API / fallback) — o deploy Docker não precisa de volumes nem APIs de FS no servidor.

## Stack

- **Editor:** CodeMirror 6
- **Preview:** react-markdown + remark-gfm + rehype-sanitize → rehype-pretty-code (Shiki)
- **Arquivos locais:** `browser-fs-access` (ponyfill) + IndexedDB para handles de pasta no Chromium
- **Anotações:** SVG overlay + perfect-freehand (só no preview expandido)
- **Exportação PDF:** unified (remark/rehype) → HTML sanitizado → html2canvas (PNG) + jsPDF (A4, paginação por fatias)
- **Persistência:** localStorage (`md-draft`, `md-theme`, `md-annotations:{hash}`); pasta aberta via handles no IndexedDB (Chromium)

## Docs

- [Roadmap do explorador](docs/roadmap-explorador-arquivos.md) — decisões de arquitetura e compatibilidade de browsers
