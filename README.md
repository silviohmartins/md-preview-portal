# mdPreviewPortal

Editor Markdown com preview ao vivo — Next.js + CodeMirror + remark/rehype.

## Funcionalidades

- **Editor** com syntax highlight (CodeMirror 6) e auto-save em `localStorage`
- **Preview** ao vivo com GFM, tabelas, task lists e syntax highlight (Shiki)
- **Copiar** — botão no painel Editor copia o markdown bruto para a área de transferência
- **Exportar PDF** — botão no painel Preview baixa o conteúdo formatado como `mdPreviewPortal.pdf`
- **Tema** claro/escuro e preview expandido em overlay

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
docker build -t md-preview-portal .
docker run -p 3000:3000 md-preview-portal
```

Healthcheck: `GET /api/health` → `{ "status": "ok" }`

## Stack

- **Editor:** CodeMirror 6
- **Preview:** react-markdown + remark-gfm + rehype-sanitize → rehype-pretty-code (Shiki)
- **Exportação PDF:** unified (remark/rehype) + html2canvas + jsPDF
- **Persistência:** localStorage (`md-draft`, `md-theme`)
