# Registro de assets

Gerado por `tools/generate-assets.mjs`. Todos os recursos são desenhados por código (primitivas, ruído procedural, contorno automático).

| Arquivo | Dimensões | Técnica |
|---|---|---|
| `public/assets/textures/grass_ground.png` | 256x256 | ruído fBm periódico + pontos de cor (tileável) |
| `public/assets/textures/dirt_path.png` | 128x128 | ruído fBm periódico com seixos |
| `public/assets/textures/stone_plaza.png` | 128x128 | ladrilhos 32px com ruído fBm (tileável) |
| `public/assets/textures/moss_stone.png` | 128x128 | pedra com musgo por ruído fBm (tileável) |
| `public/assets/textures/bark.png` | 128x256 | ruído anisotrópico periódico (casca) |
| `public/assets/textures/corrupt_ground.png` | 256x256 | ruído fBm + veios de ridged noise (tileável) |
| `public/assets/textures/wood_wall.png` | 64x64 | tábuas horizontais com veio fBm |
| `public/assets/textures/stone_wall.png` | 64x64 | alvenaria de pedra em fiadas |
| `public/assets/textures/shingle_roof.png` | 64x64 | telhas em escamas com sulco |
| `public/assets/textures/door.png` | 16x32 | porta de tábuas desenhada por código |
| `public/assets/textures/window_lit.png` | 16x16 | janela iluminada (emissiva) |
| `public/assets/vegetation\leaf_clusters.png` | 256x256 | folhagem: 170 folhas elípticas por agrupamento, sombreadas por altura |
| `public/assets/vegetation\flowers.png` | 128x16 | flores de 5 pétalas em pixel art, 8 variantes |
| `public/assets/vegetation\mushrooms.png` | 32x16 | cogumelos de duas cores |
| `public/assets/vegetation\ferns.png` | 64x32 | samambaias: frondes com folíolos desenhados por linha |
| `public/assets/textures/rock_moss.png` | 64x64 | pedra com musgo por ruído (silhueta elíptica) |
| `public/assets/textures/light_shaft.png` | 32x256 | gradiente gaussiano vertical (raio de sol) |
| `public/assets/textures/glow_soft.png` | 64x64 | halo radial (aura aditiva) |
| `public/assets/textures/blob_shadow.png` | 32x16 | sombra elíptica suave |
| `public/assets/sprites\player.png` | 144x128 | herói 24x32 desenhado por primitivas (elipses, retângulos, linhas) + contorno automático |
| `public/assets/sprites\villager_a.png` | 96x128 | aldeão 24x32 desenhado por primitivas, sem arma, com variação de cores |
| `public/assets/sprites\villager_b.png` | 96x128 | aldeão 24x32 desenhado por primitivas, sem arma, com variação de cores |
| `public/assets/sprites\herald.png` | 256x64 | arauto 64x64 com seis asas de penas desenhadas por polígonos, batimento em 4 quadros |
| `public/assets/sprites\creature.png` | 256x24 | criatura corrompida 32x24 desenhada por primitivas, dissipação por remoção de pixels |
| `public/assets/sprites\fragment.png` | 64x16 | fragmento de cristal 16x16, 4 quadros de pulsação |

Cada sheet em `public/assets/sprites/` e `public/assets/vegetation/` tem um `.json` de metadados (quadros e animações).
