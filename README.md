# Still Focus

Uma ferramenta de foco minimalista: full-screen background personalizável, galeria de wallpapers, camada ASCII e ordered dithering, timer preciso baseado em timestamp, sons discretos, múltiplos idiomas e múltiplos formatos de cronômetro.

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

Como é um site estático (sem backend), qualquer host de arquivos estáticos funciona — **inclua a pasta `wallpapers/` no upload/commit**, ela é parte do site:

- **Vercel / Netlify**: arraste a pasta `pomodoro/` inteira no dashboard, ou faça deploy via CLI apontando para esta pasta.
- **GitHub Pages**: suba todos os arquivos e a pasta `wallpapers/` para a raiz do repositório e ative Pages na branch principal.
- **Cloudflare Pages**: mesma ideia — projeto estático, sem comando de build.

## Estrutura

```
index.html      → markup e estrutura das camadas (background / dither / ascii / UI)
style.css       → design tokens (cores, tipografia, spacing, radius, blur) e layout
app.js          → estado do timer, modos, formatos, configurações, persistência (localStorage)
ascii.js        → motor da camada ASCII (canvas, sem nós DOM por caractere)
dither.js       → motor do ordered dithering (matriz de Bayer + ruído monocromático)
i18n.js         → dicionário de traduções (PT/EN) e aplicação via atributos data-i18n
wallpapers/     → wallpapers abstratos originais (PNG + thumbnail) usados na Galeria
```

## Decisões de implementação

- **Timer**: usa `Date.now()` + timestamp de término (não `setInterval` puro), então continua correto mesmo com a aba em segundo plano; recalcula ao voltar o foco.
- **4 formatos de cronômetro** (trocáveis em Configurações → Formato):
  - **Cronômetro** — o comportamento original: Focus / Short Break / Long Break contando regressivamente.
  - **Pomodoro** — igual ao Cronômetro, mas com um indicador de progresso (4 pontos) e avança automaticamente de modo ao concluir uma sessão (Focus → Short Break; a cada 4ª sessão → Long Break; qualquer pausa → Focus). Não inicia a próxima sessão sozinho, só troca o modo selecionado.
  - **Relógio** — mostra a hora atual (HH:MM:SS), sem controles de start/pause (é sempre "ao vivo").
  - **Contador** — cronômetro progressivo, começa em 00:00 e sobe até o usuário pausar.
  - *Nota: como "Pomodoro" e "Cronômetro" eram descritos de forma um pouco ambígua no pedido original, adotei essa interpretação — se não for exatamente o que você tinha em mente, me diga como ajustar.*
- **Galeria de wallpapers**: 8 wallpapers abstratos **gerados originalmente** para este projeto (não são fotos de banco de imagens, para não trazer risco de direitos autorais para o seu repositório). Ficam em `wallpapers/`, referenciados por caminho relativo — você pode substituí-los ou adicionar os seus na mesma pasta.
- **Cor de destaque adaptativa**: o botão Start (e o switch dos toggles) extrai um tom vívido do wallpaper atual (pixel mais saturado da imagem, ou a matiz do gradiente/cor sólida) para sempre combinar com o fundo.
- **ASCII**: um único `<canvas>`, com um campo de ruído procedural (quando o fundo é cor/gradiente/padrão) ou amostragem de brilho da imagem do usuário (quando o fundo é uma imagem).
- **Ordered Dithering**: também um único `<canvas>`, com um toggle "Manter cores originais" — desligado, gera um duotone com base na matiz do fundo; ligado, preserva as cores reais da imagem, apenas clareando/escurecendo cada ponto conforme a matriz de Bayer.
- **Sons**: sintetizados via Web Audio API (sem arquivos de áudio externos) — som de início/pausa, tique-taque por segundo (alternando dois tons, como um relógio real) e o som de conclusão. Os três são individualmente ativáveis/desetiváveis em Configurações → Áudio, com o tique-taque desligado por padrão (para não ser cansativo em sessões longas).
- **Idioma**: PT/EN via `i18n.js`, aplicado a todos os textos marcados com `data-i18n` / `data-i18n-aria` / `data-i18n-placeholder`. Fácil de adicionar um terceiro idioma editando o objeto `STRINGS`.
- **Contraste adaptativo**: a cor do texto (`--color-fg`) é recalculada a partir da cor média do fundo — fundo escuro vira texto quase-branco tingido do matiz do fundo, fundo claro vira texto quase-preto do mesmo jeito. O painel de configurações e a galeria, porém, fixam seus próprios tokens de cor (não herdam esse cálculo), porque sempre ficam sobre seu próprio vidro escuro.
- **Persistência**: `localStorage`, sem backend. Se uma imagem muito grande estourar a cota, o app cai de volta para o background padrão silenciosamente em vez de quebrar.
- **Acessibilidade**: navegação por teclado (Space inicia/pausa, Esc fecha configurações/galeria), `aria-live` no rótulo do modo, foco visível, suporte a `prefers-reduced-motion`.
