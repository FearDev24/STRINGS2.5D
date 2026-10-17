# Relatório técnico — Experimento Strings 2.5D

## 1. Resumo

A demonstração "Vila do Primeiro Fio" foi implementada do zero em Three.js + TypeScript, com recursos gerados por código. Estão funcionando, e verificados neste ambiente:

- vila com praça, portal animado, cinco casas, cercas, lanternas, poço e decoração;
- bosque com grama instanciada com vento, flores, samambaias, cogumelos, rochas, raízes e árvores com copas em camadas;
- zona corrompida com cristais, veios e partículas;
- personagem controlável por grade (passo a passo com interpolação), dois aldeões, Arauto, criatura com IA e três fragmentos;
- missão completa de ponta a ponta, com persistência local;
- HUD, diálogo com digitação, menu de pausa, configurações gráficas por preset e por efeito, métricas (F3);
- 24 testes automatizados passando.

**Conclusão honesta sobre o critério de fidelidade:** a demo **não** está visualmente aprovada pelos critérios da seção 13 do pedido. A floresta ainda parece menos rica que a referência: as copas são cartões pixelados, a luz solar volumétrica quase não aparece, e o GTAO (oclusão ambiental) escurece a cena, por isso está desligado por padrão. Detalhes na seção 5.

**Limitação de comparação:** a imagem de referência do Luminati não estava anexada à mensagem. Por isso não fiz comparação lado a lado com ela. A avaliação abaixo compara a demo com os critérios do pedido, com evidência das capturas em `docs/screenshots/`.

## 2. Tecnologias

| Área | Tecnologia |
|---|---|
| Renderização | Three.js 0.170 (WebGL2) |
| Linguagem | TypeScript (checagem com `tsc --noEmit`) |
| Build / dev | Vite 6 |
| Testes | Vitest 2.1 (lógica, persistência, layout, assets) |
| Pós-processamento | EffectComposer, RenderPass, GTAOPass, BokehPass, UnrealBloomPass, OutputPass (ACES) |
| Interface | HTML/CSS e DOM (sem framework) |

Sem dependências externas em tempo de execução. Sem chamadas de rede durante o jogo.

## 3. Recursos criados por procedimento

Tudo sai de `tools/generate-assets.mjs` e `tools/raster.mjs` (rasterizador próprio e encoder PNG, usando só `zlib` do Node). Detalhes e técnica de cada PNG em [docs/ASSET_REGISTRY.md](docs/ASSET_REGISTRY.md).

- **Texturas tileáveis** (ruído fBm periódico com período dobrando por oitava): grama, terra, pedra de praça, pedra com musgo, casca, solo corrompido.
- **Arquitetura:** tábuas de madeira, alvenaria, telhas em escamas, porta e janela iluminada.
- **Folhagem:** 4 agrupamentos de copa (170 folhas elípticas cada), 8 variantes de flor, 2 samambaias, 2 cogumelos, pedra com musgo, raio de sol, halo, sombra de contato.
- **Personagens (pixel art desenhada por primitivas e contorno automático):** herói 24x32 com 6 poses e 4 direções; 2 aldeões; Arauto 64x64 com seis asas em 4 quadros de batimento; criatura corrompida 32x24 com andar, ataque, dano e 4 quadros de dissipação; fragmento 16x16 com 4 quadros de pulsação.
- **Metadados:** cada sheet tem JSON com quadros, animações, técnica e geração. O `manifest.json` lista todos os arquivos.

Nenhum asset de terceiros foi usado.

## 4. Implementação por área

### Câmera e composição
- Perspectiva de 32°, posição elevada (`FollowCamera`), seguimento com suavização exponencial e olhar levemente acima do jogador (para as copas entrarem no enquadramento).
- Profundidade de campo com `BokehPass`, com foco na distância até o herói.
- **Ocultação:** copas de árvores que ficam entre a câmera e a cabeça do herói são escondidas por escala zero (sem transparência gradual). Esse foi um ponto de atenção: a regra foi estreitada para não esconder árvores à frente do herói sem necessidade.

### Iluminação e atmosfera
- Sol direcional quente com sombras PCF suaves (tamanho do mapa por preset: 512 / 1024 / 2048).
- Luz hemisférica (céu azul, chão verde) e céu em gradiente com halo solar.
- Névoa exponencial (`FogExp2`) em tom verde-acinzentado.
- **Raios volumétricos:** aproximados por 9 faixas aditivas com textura gaussiana. **Na prática quase não aparecem nas capturas** (ver seção 5).
- Vaga-lumes e poeira iluminada: pontos animados por shader, com brilho pulsante.
- Folhas caindo: InstancedMesh com queda, balanço e rotação.
- Bloom seletivo (limiar 0,88) e tonemapping ACES.

### Vegetação
- Grama: InstancedMesh de lâminas em tiras triangulares, 9k / 22k / 42k por preset, agrupadas em moitas, com variação de tom e vento por vértice (`withWind`, deslocamento por posição de instância).
- Flores: 8 variantes em 8 InstancedMeshes, com alfa e vento leve.
- Árvores: tronco instanciado (com sombra), núcleo escuro de copa e 7 planos de copa por árvore (4 variantes). Presets 55 / 90 / 130 árvores. A lista é determinística; um preset maior inclui todas as árvores do menor.
- Samambaias, cogumelos e rochas com musgo; raízes em tubo ao redor de algumas árvores.
- Terreno: malha com altura suave no bosque e faixa plana no caminho, cor por região (vila clara, bosque escuro, zona roxa).

### Mundo e colisão
- Grade de células de 1 unidade. Colisão só com construções, cercas, lanternas, poço, portal e troncos. Grama, flores e decoração não bloqueiam.
- A grade é a mesma usada pelos testes de alcance (busca em largura a partir do início).
- Vila e bosque são um único mundo contínuo, sem tela de carregamento na transição.

### Personagens e combate
- Herói: anda por célula (`PLAYER_SPEED` 4,2 células/s) com interpolação visual; quadros de idle, andar, ataque, dano; invulnerabilidade curta após dano.
- Ataque: janela de acerto em arco no meio da animação. Mira automática: ao atacar, o herói se vira para a criatura se ela estiver a até 2,6 unidades.
- Criatura: estados `idle`, `chase`, `telegraph` (pisca e avisa), `lunge` (investida que para ao chegar ao herói), `recover`, `dying` (dissipação em 4 quadros) e `dead`. 4 pontos de vida, barra sobre a cabeça.
- Aldeões: vagueiam perto de casa, com quadros de andar e idle. Interação com E.

### Missão e persistência
- Máquina de estados pura (`src/game/quest.ts`): `despertar` → `ecos` → `corrupcao` → `retorno` → `concluida`.
- Persistência em `localStorage` com validação de esquema (etapa, fragmentos, booleanos, posição). Save inválido volta ao início sem apagar nada. Falha de armazenamento não quebra o jogo.
- Conclusão: pulso do portal, partículas, tela de conclusão e objetivo atualizado.

### Interface
- HUD em DOM: vida (6 corações), missão, dica de interação, diálogo com digitação, aviso temporário, métricas (F3).
- Menu de pausa: continuar, configurações gráficas, métricas, reiniciar progresso.
- Configurações: preset, e cada efeito individualmente (sombras, GTAO, bloom, DOF, raios, névoa, vaga-lumes, folhas). Persistidas em `localStorage`.
- Layout testado em 375 px: sem rolagem horizontal.

## 5. Avaliação de fidelidade (critérios da seção 13)

Notas de 0 a 10, com evidência. Não atribuí dez a nenhum item.

| Critério | Nota | Evidência e justificativa |
|---|---|---|
| Qualidade da vegetação | 5 | Grama densa com vento, flores variadas e copas em camadas. As copas são cartões pixelados visivelmente planos de perto; faltam silhuetas mais volumosas e variedade de folhas. |
| Profundidade visual | 5 | Sombras de troncos, névoa e planos sobrepostos dão alguma profundidade. Falta gradação atmosférica forte entre primeiro plano e fundo. |
| Iluminação solar | 5 | Sol quente com sombras visíveis, mas a luz soa plana. Não há "golden hour" marcante. |
| Raios volumétricos | 2 | Os planos de raio existem, mas não aparecem de forma perceptível nas capturas. Aproximação fraca. |
| Sombras | 5 | Sombras de troncos e de copas são visíveis (PCF suave). Não acompanham o vento (o mapa de profundidade não usa o deslocamento). |
| Profundidade de campo | 3 | O BokehPass está ativo, mas o desfoque de fundo e primeiro plano quase não se nota nas capturas. Nota baixa por efeito praticamente invisível. |
| Qualidade dos sprites | 6 | Pixel art legível, com contorno, fio dourado e variação de cores entre personagens. Pequena (24x32) e com poucas poses de ataque. |
| Animações | 5 | Vento na grama e nas copas, andar, batimento das asas do Arauto, estados da criatura. Faltam animações de aldeões e de interação. |
| Densidade ambiental | 6 | 42k lâminas, 1.800 flores e 130 árvores no preset Alto. Densidade boa ao nível do chão, mas as copas se espalham pouco no enquadramento. |
| Atmosfera cinematográfica | 4 | Névoa, vaga-lumes, folhas e zona roxa dão clima. Falta luz dourada marcante e os raios de sol que dariam o caráter da referência. |

**Média: 4,6 / 10.** Pela regra da seção 13, a demo **não** está aprovada visualmente. Não há indício de que a floresta seja "plana" ou "de blocos" nas capturas atuais, mas também não atinge a riqueza descrita.

### Por que a demo ainda parece inferior
1. **Raios volumétricos quase ausentes.** A aproximação com planos aditivos é fraca. Uma solução melhor exigiria um passe de espalhamento por raio de sol (raymarching a partir do buffer de profundidade), que não foi implementado.
2. **GTAO desligado.** Ao ligar, a cena inteira escurece (ver `docs/screenshots/dbg_profundo_com_ao.png` contra `dbg_profundo_sem_ao.png`). Suspeito de interação entre o passe de normais do GTAO e as instâncias com teste de alfa, mas não investiguei a fundo. Sem AO, falta contato de sombra na base das árvores e entre as moitas.
3. **Copas com aparência de cartão.** Cada copa é um plano com textura de folhas. Visto de cima, o volume depende do núcleo escuro, que ficou discreto. Uma copa com malha de folhas ou billboards em mais camadas daria mais volume.
4. **Composição apertada.** Com a câmera a 12 unidades do herói, objetos próximos (troncos, copas, moitas) tomam grande parte do quadro, e a sensação de miniatura se perde. Afastar a câmera deixa a cena mais ampla, mas reduz a leitura dos sprites.
5. **Bokeh quase imperceptível.** O desfoque precisa de calibração de abertura e de distância de foco por preset.

## 5b. Comparação com a referência enviada (5 imagens)

Depois da seção 5, o usuário enviou cinco imagens de referência do mesmo cenário em horários e climas diferentes: golden hour, chuva, neve e crepúsculo. Elas mostram uma vila em pixel art 2.5D com câmera diagonal, casas com janelas acesas, cercas, árvores de copa densa em laranja e verde, flores espalhadas, vaga-lumes desfocados como bokeh, luz dourada de contraluz, foco no centro e desfoque forte no primeiro plano. A origem exata das imagens não foi verificada por mim; a comparação abaixo é com o que elas mostram.

Comparação direta com as capturas da demo (`vila_plaza_alto`, `bosque_clareira_alto`, `comparacao_baixo_vs_alto`):

| Aspecto | Referência | Demo |
|---|---|---|
| Cor e luz | Saturada, luz dourada de contraluz, realces quentes nas bordas | Tons verdes e roxos dessaturados; sol neutro; sem realce quente |
| Vegetação | Copas grandes e densas em duas cores (laranja e verde), com volume | Copas em cartão, pouca variação de cor, pouco volume |
| Flores e chão | Manchas de flores coloridas e touceiras bem definidas | Flores pequenas e esparsas; chão verde liso |
| Profundidade de campo | Primeiro plano (arbustos) fortemente desfocado; foco no centro | Desfoque quase imperceptível |
| Raios e bokeh | Raios de sol visíveis; vaga-lumes viram círculos de bokeh | Raios quase invisíveis; vaga-lumes são pontos pequenos |
| Personagens | Lidos de longe, com sombreado e detalhes de roupa | Pequenos e pouco detalhados no enquadramento |
| Clima e hora | Quatro variações (golden hour, chuva, neve, crepúsculo) | Um só horário, sem clima |
| Interface | Moldura dourada, minimapa, relógio | HUD simples em painéis escuros |

Notas revisadas (0 a 10), com a referência como base:

| Critério | Nota anterior | Nota revisada | Motivo |
|---|---|---|---|
| Qualidade da vegetação | 5 | 4 | Falta volume e cor nas copas; a referência tem copas grandes e coloridas |
| Profundidade visual | 5 | 4 | Falta a camada de desfoque e névoa que separa primeiro plano e fundo |
| Iluminação solar | 5 | 3 | A referência tem contraluz dourado; a demo não |
| Raios volumétricos | 2 | 2 | Mantida: quase invisíveis |
| Sombras | 5 | 4 | Existem, mas não dão o contraste quente da referência |
| Profundidade de campo | 3 | 3 | Mantida: o efeito é quase imperceptível |
| Qualidade dos sprites | 6 | 5 | Legíveis e consistentes, mas com menos sombreado e tamanho menor no enquadramento |
| Animações | 5 | 4 | A referência tem clima e partículas animadas; a demo tem vento e poucas animações |
| Densidade ambiental | 6 | 4 | A referência preenche o quadro de flores e folhagem; a demo tem vazios |
| Atmosfera cinematográfica | 4 | 3 | Sem a névoa dourada e os círculos de bokeh que dão o clima da referência |

**Média revisada: 3,6 / 10.** A nota anterior (4,6) era otimista. Na comparação direta, a demo fica claramente abaixo da referência em cor, densidade e luz. O critério da seção 13 não é atingido.

### Lacunas prioritárias (em ordem de impacto)
1. **Luz dourada e realces quentes:** tonalidade do sol e do céu, mais bloom nas bordas iluminadas.
2. **Copas volumosas e coloridas:** mais variedade de cor nas folhas e mais camadas de copa.
3. **Profundidade de campo calibrada:** desfoque forte no primeiro plano, que é o que cria a sensação de miniatura da referência.
4. **Partículas como bokeh:** vaga-lumes maiores e mais suaves, com halo.
5. **Densidade de flores e folhagem:** mais touceiras coloridas no chão e nas bordas da câmera.
6. **Clima e horário:** ciclo de luz e, se for o caso, chuva e neve. Não estava no escopo inicial, mas as referências os mostram.

## 5c. Passagem visual seguindo a referência (v3)

Depois da seção 5b, foi feita uma passagem para aproximar a demo das cinco referências, sem copiar sprites ou texturas delas. Tudo continua gerado por código.

O que mudou:
- **Luz:** sol de contraluz âmbar (`#ffb860`, intensidade 3,2), luz hemisférica quente, céu e névoa dourados, raios de sol mais fortes e exposição 1,12.
- **Bloom:** limiar 0,72 e força 0,55, para realçar as bordas iluminadas.
- **Copas:** o gerador passou a produzir agrupamentos laranja e vermelho, além dos verdes. A grama ganhou tons ocres.
- **Flores:** 3.600 no preset Alto (antes 1.800) e 2.000 no Médio (antes 1.000).
- **Profundidade de campo:** abertura 0,0004 e desfoque máximo 0,009. Ajustada para não desfocar a praça, mas o desfoque de primeiro plano ainda é fraco.
- **Vaga-lumes:** maiores, com disco suave e halo, lidos como bokeh.
- **Clima:** quatro opções, escolhidas no menu de gráficos: hora dourada (padrão), crepúsculo, chuva (linhas de chuva com névoa cinza) e neve (flocos). O clima troca névoa, céu, cor e intensidade do sol.
- **Interface:** painéis com moldura dourada dupla, caixa de diálogo em azul-marinho, e um relógio de tempo de jogo que avança a partir das 18:12 com o nome do clima.

Limitações observadas nesta passagem:
- A praça ficou muito clara, com bloom excessivo nas pedras. Não corrigida nesta rodada.
- O desfoque de primeiro plano é fraco. As referências têm desfoque forte nas bordas da imagem.
- Os climas crepúsculo e neve foram verificados só em captura; o chuva foi verificado visualmente.
- O GTAO continua desligado por padrão.

Capturas desta passagem: `docs/screenshots/v3_*.png`.

## 6. Testes e verificações executados

| Verificação | Resultado |
|---|---|
| `npx tsc --noEmit` | Passa |
| `npm test` (Vitest, 4 arquivos, 24 testes) | 24 passam |
| `npm run build` (Vite) | Passa (bundle ~620 kB, 160 kB gzip) |
| Carregamento no navegador (sem erros no console) | Passa |
| Missão ponta a ponta no navegador: conversa, 3 fragmentos, criatura derrotada, entrega, tela de conclusão | Passa (executado por script no console, com a lógica real do jogo) |
| Persistência: recarregar a página depois de concluir | Passa (missão, fragmentos e criatura restaurados) |
| Menu de configurações e trocas de preset | Passa (preset e efeitos aplicados) |
| Layout em 375 px | Sem rolagem horizontal |
| Desempenho na janela do navegador embutido (Alto, 1053x862) | ~60 FPS, 600 draw calls, ~910k triângulos |

Limitações dessas verificações:
- O navegador de teste é o embutido do aplicativo (Chromium), não a GPU NVIDIA de 8 GB de referência. Os 60 FPS não foram medidos nessa GPU.
- Os testes de navegador não são automatizados neste repositório. Foram executados manualmente pelo console de depuração (`window.__strings25d`, disponível só em desenvolvimento).
- Não há teste de controle por toque nem de áudio.

## 7. Limitações conhecidas

- **Referência não comparada:** a imagem do Luminati não estava anexada; nenhuma comparação lado a lado com ela foi feita.
- **Raios volumétricos** são aproximados e quase invisíveis (seção 5).
- **GTAO** desligado por padrão por causa do escurecimento.
- **Ocultação de copas** é por escala zero, sem transparência gradual; a copa some de uma vez.
- **Sombras e vento:** as sombras não acompanham o balanço da vegetação.
- **Trocar de preset** reconstrói a vegetação (pequeno travamento).
- **Sem áudio** (item opcional do pedido, não implementado).
- **Animações limitadas:** aldeões não têm animação de interação; criatura tem um ataque.
- **Quest simples:** dois aldeões com uma fala cada.
- **Mira automática** é em 4 direções, não em 360°.
- **Depuração:** `window.__strings25d` só existe em desenvolvimento; `?capture=1` mantém o buffer do canvas para capturas.

## 8. Como reproduzir

Veja o [README.md](README.md): `npm install`, `npm run assets`, `npm run dev`, `npm test`, `npm run build`.
