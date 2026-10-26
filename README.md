# Strings 2.5D — Vila do Primeiro Fio

Experimento jogável em navegador que explora uma versão 2.5D do universo Strings. O jogador percorre uma vila, coleta Ecos e enfrenta uma criatura corrompida em uma missão curta com progresso salvo localmente.

## Destaques

- mundo contínuo com vila, bosque e zona corrompida;
- personagem controlável, aldeões, Arauto, criatura com IA e fragmentos;
- diálogo, missão com estados, combate e persistência em `localStorage`;
- câmera em perspectiva, vegetação instanciada, partículas, iluminação e presets gráficos;
- 24 testes automatizados de missão, armazenamento, layout e assets.

## Stack

Three.js, TypeScript, Vite, WebGL2 e Vitest. Os assets são gerados por código e não há chamadas de rede durante o jogo.

## Executar

Requer Node.js 20+ e navegador com WebGL2.

```bash
npm install
npm run dev
```

Abra `http://127.0.0.1:5173/`. Para produção e testes: `npm run build` e `npm test`.

## Controles

WASD/setas movem; `E` interage; `J` ou Espaço ataca; `Esc` abre o menu; `F3` mostra métricas.
