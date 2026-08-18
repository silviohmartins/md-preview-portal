# mdstudio.io

Editor Markdown com preview ao vivo — Next.js + CodeMirror + remark/rehype.

## Funcionalidades

- **Editor** com syntax highlight (CodeMirror 6)
- **Explorador de arquivos** — abrir pasta local, listar `.md`, editar e salvar (Chrome/Edge grava no arquivo; Firefox/Safari baixam uma cópia). Painel lateral recolhível
- **Draft avulso** — sem pasta aberta, auto-save em `localStorage` (`md-draft`)
- **Preview** ao vivo com GFM, tabelas, task lists e syntax highlight (Shiki)
- **Privacidade do preview** — imagens remotas em Markdown são bloqueadas por padrão; imagens locais/servidas pelo próprio app continuam permitidas
- **Copiar** — botão no painel Editor copia o markdown bruto para a área de transferência
- **Exportar PDF** — botão no painel Preview baixa o conteúdo formatado como `mdstudio.io.pdf`
- **Tema** claro/escuro e preview expandido em overlay
- **Sync scroll** — alinha o scroll do editor e do preview (toggle na toolbar / ícone do editor)
- **Anotações (caneta)** — no preview expandido, camada de “vidro” para desenhar marcações sem alterar o markdown (caneta, marcador, borracha, undo/redo); persistidas em `localStorage` pela identidade do workspace e caminho do arquivo

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

No Chrome/Edge, o handle da pasta permite reconhecer o mesmo workspace em uma
nova seleção ou sessão. O fallback de Firefox/Safari não fornece uma identidade
opaca da pasta: para impedir que pastas homônimas compartilhem desenhos, cada
seleção recebe uma identidade isolada e suas anotações valem apenas para aquela
abertura.

O build usa Node.js 24 LTS e gera somente arquivos estáticos. A imagem de
produção usa Nginx, sem servidor Node.js, e serve o healthcheck estático em
`/api/health`. O Nginx aplica CSP e os demais headers de segurança a todas as
respostas; a CSP também impede que o navegador carregue imagens de terceiros.

Em uma hospedagem estática sem a imagem Docker, a infraestrutura deve reproduzir
os headers de `deploy/nginx.conf` e resolver rotas como `$uri`, `$uri.html` ou
`$uri/`, com fallback de erro para `404.html`.

## Stack

- **Editor:** CodeMirror 6
- **Preview:** react-markdown + remark-gfm + rehype-sanitize → rehype-pretty-code (Shiki)
- **Arquivos locais:** `browser-fs-access` (ponyfill) + IndexedDB para handles de pasta no Chromium
- **Anotações:** SVG overlay + perfect-freehand (só no preview expandido)
- **Exportação PDF:** unified (remark/rehype) → HTML sanitizado → html2canvas (PNG) + jsPDF (A4, paginação por fatias)
- **Persistência:** localStorage (`md-draft`, `md-theme` e anotações identificadas por versão + workspace + caminho); pasta aberta via handles no IndexedDB (Chromium)
