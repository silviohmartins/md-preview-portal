import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import nextConfig from "./next.config";

const nginxConfig = readFileSync(
  resolve(process.cwd(), "deploy/nginx.conf"),
  "utf8",
);
const securityHeaders = readFileSync(
  resolve(process.cwd(), "deploy/security-headers.conf"),
  "utf8",
);
const dockerfile = readFileSync(resolve(process.cwd(), "Dockerfile"), "utf8");

describe("static production deployment", () => {
  it("exports the application without a Next.js runtime server", () => {
    expect(nextConfig.output).toBe("export");
    expect(nextConfig.headers).toBeUndefined();
    expect(dockerfile).toContain(
      "FROM nginxinc/nginx-unprivileged:1.30.4-alpine3.24 AS runner",
    );
    expect(dockerfile).toMatch(
      /COPY --from=builder(?: --chown=\S+)? \/app\/out \/usr\/share\/nginx\/html/,
    );
    expect(dockerfile).toContain("USER 101");
    expect(dockerfile).not.toContain('CMD ["node"');
  });

  it("keeps security headers on every Nginx response", () => {
    expect(securityHeaders).toMatch(
      /add_header Content-Security-Policy .*frame-ancestors 'none'.* always;/,
    );
    expect(securityHeaders).toMatch(/img-src 'self' blob: data:/);
    expect(securityHeaders).not.toMatch(/img-src[^;]*https?:/);
    expect(securityHeaders).not.toContain("'unsafe-eval'");
    expect(securityHeaders).toContain("'wasm-unsafe-eval'");
    expect(securityHeaders).toMatch(/add_header Referrer-Policy .* always;/);
    expect(securityHeaders).toMatch(/add_header X-Content-Type-Options .* always;/);
    expect(securityHeaders).toMatch(/add_header Permissions-Policy .* always;/);
    expect(nginxConfig.match(/include \/etc\/nginx\/snippets\/security-headers\.conf;/g)).toHaveLength(3);
  });

  it("serves the static healthcheck and generated route fallbacks", () => {
    expect(nginxConfig).toContain("location = /api/health");
    expect(nginxConfig).toContain("try_files $uri $uri.html $uri/ =404;");
    expect(nginxConfig).toContain("error_page 404 /404.html;");
  });

  it("uses immutable caching for hashed assets and revalidates pages", () => {
    expect(nginxConfig).toContain(
      'add_header Cache-Control "public, max-age=31536000, immutable" always;',
    );
    expect(nginxConfig).toContain(
      'add_header Cache-Control "no-cache" always;',
    );
  });
});
