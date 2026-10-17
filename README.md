# Strings — Vila do Primeiro Fio (experimento 2.5D)

Demonstração técnica jogável, em 2.5D, ambientada no universo Strings. É um experimento independente: não modifica o MMORPG Strings nem usa seus assets.

- **Motor:** Three.js 0.170 + TypeScript + Vite 6 (WebGL2)
- **Recursos gráficos:** todos gerados por código (`tools/generate-assets.mjs`). Nenhum arquivo de terceiros.
- **Serviços externos:** nenhum, em tempo de execução. Tudo roda localmente.

Veja também: [RELATORIO_TECNICO.md](RELATORIO_TECNICO.md) (implementação, avaliação de fidelidade e limitações) e [docs/ASSET_REGISTRY.md](docs/ASSET_REGISTRY.md) (registro de assets).

## Requisitos (Windows)

- Node.js 20 ou mais recente (testado com Node 24) e npm.
- Navegador com WebGL2 (Chrome ou Edge atualizados).

## Instalação

```bash
npm install
```

Instala Three.js, Vite, Vitest e TypeScript (dependências declaradas em `package.json`).

## Gerar os assets

```bash
npm run assets
```

Escreve `public/assets/**` (PNG + JSON de metadados de animação + `manifest.json`) e `docs/ASSET_REGISTRY.md`. Os assets já estão gerados neste diretório; rode de novo só para regenerar.

## Executar

```bash
npm run dev
```

Abra `http://127.0.0.1:5173/`.

## Gerar a versão de produção

```bash
npm run build
npm run preview
```

`build` faz a checagem de tipos (`tsc --noEmit`) e empacota em `dist/`. `preview` serve em `http://127.0.0.1:4173/`.

## Testes automatizados

```bash
npm test
```

Vitest, 24 testes:
- `tests/quest.test.ts`: máquina de estados da missão (ordem, duplicatas, travas de etapa).
- `tests/storage.test.ts`: persistência local, saves corrompidos, armazenamento bloqueado.
- `tests/layout.test.ts`: alcance de todos os pontos de interesse (busca em largura), presets, determinismo das árvores.
- `tests/assets.test.ts`: PNGs válidos, dimensões do manifesto, quadros e animações dentro dos limites.

Os testes de comportamento em navegador (conversa, coleta, combate, conclusão, persistência) foram executados manualmente pelo console de depuração, descritos no relatório técnico. Não há suíte automatizada de navegador neste repositório.

## Controles

| Ação | Tecla |
|---|---|
| Mover (um passo por célula) | WASD ou setas |
| Conversar / continuar diálogo | E (ou Enter no diálogo) |
| Atacar (vira-se para a criatura próxima) | J ou Espaço |
| Menu de pausa / configurações | Esc |
| Métricas técnicas (FPS, draw calls, triângulos) | F3 |

## Como jogar a missão

1. Fale com o Arauto na praça (E).
2. Encontre os três Ecos luminosos no Bosque das Cordas, a leste (passe sobre eles).
3. Derrote a criatura corrompida na zona roxa, mais a leste (J ou Espaço, de frente para ela).
4. Volte ao Arauto e entregue os Ecos (E). A missão é concluída e o progresso fica salvo no navegador.

O progresso é salvo em `localStorage` (chave `strings25d.save.v1`). Use "Reiniciar progresso" no menu de pausa para começar de novo.

## Configurações gráficas

No menu de pausa, "Configurações gráficas": presets Baixo, Médio e Alto, e cada efeito pode ser ligado ou desligado individualmente (sombras, GTAO, bloom, profundidade de campo, raios de sol, névoa, vaga-lumes, folhas). Trocar o preset reconstrói a vegetação.

## Capturas

`docs/screenshots/` contém capturas reais tiradas do jogo em execução. Para gerar novas, abra `http://127.0.0.1:5173/?capture=1` e use o console (`window.__strings25d`), com o servidor de desenvolvimento ativo. O endpoint `/__capture` existe só no servidor de desenvolvimento e grava os PNGs nessa pasta.

## Estrutura

```
index.html                  interface (overlays, HUD, menus)
src/
  main.ts                   montagem, loop, combate, missão, configurações
  core/                     config (presets), rng determinístico, entrada do teclado
  game/                     quest (máquina de estados), storage (persistência com validação)
  world/                    layout (grade, colisão), terrain, vegetation, village, atmosphere
  render/                   assets (carregamento), materials (vento), camera, postfx
  entities/                 characters (jogador, NPCs, criatura, fragmentos), billboard, partículas
  ui/                       hud.ts e style.css
tools/
  raster.mjs                rasterizador RGBA e encoder PNG (sem dependências)
  generate-assets.mjs       gera todos os PNGs e metadados
tests/                      Vitest
public/assets/              assets gerados
docs/                       registro de assets, capturas
```
