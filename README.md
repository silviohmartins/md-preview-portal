# mdPreviewPortal

Editor Markdown com preview ao vivo — Next.js + CodeMirror + remark/rehype.

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
- **Persistência:** localStorage (`md-draft`, `md-theme`)
