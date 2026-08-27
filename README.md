# Still Focus

Uma ferramenta de foco minimalista: full-screen background personalizável, camada ASCII atmosférica em canvas, glass UI e timer preciso baseado em timestamp.

## Rodar localmente

Não há build step — é HTML/CSS/JS puro. Duas opções:

1. Abra `index.html` diretamente no navegador (duplo clique).
2. Ou sirva a pasta com qualquer servidor estático, por exemplo:
   ```
   npx serve .
   ```
   ou
   ```
   python3 -m http.server 8000
   ```

## Publicar online

Como é um site estático (sem backend), qualquer host de arquivos estáticos funciona:

- **Vercel / Netlify**: arraste a pasta `pomodoro/` no dashboard, ou faça deploy via CLI (`vercel` / `netlify deploy`) apontando para esta pasta.
- **GitHub Pages**: suba os 4 arquivos (`index.html`, `style.css`, `app.js`, `ascii.js`) para um repositório e ative Pages na branch principal.
- **Cloudflare Pages**: mesma ideia — projeto estático, sem comando de build.

## Estrutura

```
index.html   → markup e estrutura das camadas (background / dither / ascii / UI)
style.css    → design tokens (cores, tipografia, spacing, radius, blur) e layout
app.js       → estado do timer, modos, configurações, persistência (localStorage)
ascii.js     → motor da camada ASCII (canvas, sem nós DOM por caractere)
dither.js    → motor do efeito de ordered dithering (matriz de Bayer + ruído monocromático)
```

## Decisões de implementação

- **Timer**: usa `Date.now()` + timestamp de término (não `setInterval` puro), então continua correto mesmo com a aba em segundo plano; recalcula ao voltar o foco.
- **ASCII**: um único `<canvas>`, com um campo de ruído procedural (quando o fundo é cor/gradiente/padrão) ou amostragem de brilho da imagem do usuário (quando o fundo é uma imagem). Regenera a cada ~3s, não a cada frame — leve o suficiente para ficar aberto o dia inteiro.
- **Ordered Dithering**: também um único `<canvas>`, entre o background e a camada ASCII. Usa uma matriz de Bayer 4x4 para transformar a imagem (ou um campo de ruído procedural, quando não há imagem) num padrão de dois tons — as duas cores são calculadas a partir da matiz média do próprio fundo. O trabalho pesado (amostragem + threshold) acontece numa resolução reduzida, cacheada até o fundo mudar; nunca em resolução real por frame. O ruído monocromático por cima é opcional e, quando ativo, é redesenhado a cada ~140ms (ou uma única vez, se `prefers-reduced-motion` estiver ativo).
- **Contraste adaptativo**: a cor do texto (`--color-fg`) é recalculada a partir da cor média do fundo (sólido, gradiente ou imagem) — fundo escuro vira texto quase-branco tingido do matiz do fundo, fundo claro vira texto quase-preto do mesmo jeito. O painel de configurações, porém, fixa seus próprios tokens de cor (não herda esse cálculo), porque ele sempre fica sobre seu próprio vidro escuro — isso evita que a configuração vire ilegível quando o fundo da página é muito claro.
- **Persistência**: `localStorage`, sem backend. Se uma imagem muito grande estourar a cota, o app cai de volta para o background padrão silenciosamente em vez de quebrar.
- **Som de conclusão**: sintetizado via Web Audio API (dois tons suaves) — nenhum asset de áudio externo necessário.
- **Acessibilidade**: navegação por teclado (Space inicia/pausa, Esc fecha configurações), `aria-live` no rótulo do modo, foco visível, suporte a `prefers-reduced-motion`.
