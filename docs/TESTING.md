# Validação

## Testes automatizados

Resultado nesta implementação: **11 testes Node.js, 29 verificações WebGL de visão/revelação e 52 verificações WebGL de iluminação aprovados** em 17/09/2026. Os testes usam Microsoft Edge headless, PIXI 7.4.3, CachedContainer e shaders nativos da instalação 14.360. A suite de iluminação examina a saída real dos shaders padrão de iluminação/coloração/fundo e dos shaders de tocha e pulsação. As capturas e os resultados ficam em `test-results/`.

`node --test` verifica flags inválidas, atualizações remotas e remoção de flags, a preservação dos argumentos/retorno do filtro, a restauração do sampler em exceções, ausência de alocação em zero e leitura assíncrona do protótipo com componente de formulário nativo.

`tests/webgl.html` executa o shader real em PIXI/WebGL, verifica pixels de alcance, paredes, cone, sobreposição, textura lógica separada, cache, câmera, luz, escuridão e liberação de recursos. O teste de textura secundária usa o CachedContainer instalado (14.360). Os polígonos simulam resultados de LOS; o teste não executa o algoritmo de paredes nem a persistência de documentos do Foundry.

`tests/light-webgl.html` usa sete classes de shader reais do Foundry, verificando centro, faixa radial, alcance, preservação dos uniforms nativos, restauração byte a byte em zero e sucesso de vinculação do programa. Também verifica paredes, luz direcional e a transição para a iluminação de fundo. O ambiente dos shaders usa samplers mínimos e constantes de VisionMode simuladas; os shaders GLSL são os da instalação local. Os testes Node cobrem os formulários de luz, flags independentes, fontes sobrepostas com valores distintos, cache, invalidação da vinculação do shader e atualização remota da iluminação.

O usuário confirmou a visão no seu mundo da v14 e reportou que a iluminação da 0.2.0 ainda delimitava uma borda rígida. A 0.2.1 corrige a máscara visual de revelação, incluindo luz de token e Sprite do cache de fontes ambiente sob o stencil nativo de LOS. A regressão verifica uma cena sem visão finita, centro preservado, união com luz sem atenuação, iluminação global, alcance lógico intacto, cache de geometria, liberação em zero e restauração dos containers após erro. A correção ainda requer confirmação no mundo real após recarregar o módulo.

## Cena mínima nas versões 13 e 14 — pendente de execução

Crie um mundo de teste da versão alvo com apenas este módulo ativo. Use uma cena com visão de tokens, exploração de fog habilitada, iluminação global desligada, alcance 30, ângulo 360° e um token com visão habilitada. Faça os testes também como jogador dono do ator, pois um GM sem token controlado vê o mapa inteiro.

| Caso | Procedimento | Resultado esperado |
| --- | --- | --- |
| Zero | Compare módulo desativado com valor 0 | Mesma renderização nativa |
| Médio | Salve 0,5 | Transição nos últimos 25% do alcance |
| Máximo | Salve 1 | Transição nos últimos 50%, sem ampliar o alcance |
| Parede | Coloque uma parede perto e outra dentro da faixa radial | Corte rígido, sem visão além da parede |
| Porta | Abra e feche uma porta | Polígono e transição acompanham a mudança |
| Cone | Ajuste ângulo para 90°, depois 180°, e gire o token | Laterais rígidas e faixa radial alinhada |
| Fog | Mova o token; volte e recarregue | Mesma exploração com módulo desativado e ativado |
| Dois tokens | Controle simultaneamente A=0,2 e B=0,8 | Configurações individuais; união pela maior visibilidade |
| Protótipo | Salve 0,6 no Prototype Token e arraste o ator | Flag 0,6 herdada pelo novo token |
| Multiplayer | GM altera a flag de um token controlado pelo jogador | Visão atualiza no cliente do jogador sem mover nem recarregar |
| Atenuação nativa | Use 0,2 nativo e 0,7 de borda | Ambos persistem e funcionam independentemente |
| Modos | Repita em Basic, Darkvision, Monochromatic e modos do sistema | Características internas dos modos preservadas |
| Luz | Acenda uma luz e ative iluminação global | Percepção de luz segue as regras nativas |
| Câmera | Faça pan, zoom e redimensione a janela | Textura alinhada ao mapa |
| Ciclo | Troque de cena, controle outro token e exclua o token | Sem textura antiga, erros ou recursos retidos |

## Aceitação da iluminação

| Caso | Procedimento | Resultado esperado |
| --- | --- | --- |
| Luz do token | Salve 0,5 na aba Iluminação do token | Borda da luz emitida suavizada, visão independente |
| Protótipo | Salve luz 0,8 e visão 0,2; arraste o ator | Valores distintos herdados pelo novo token |
| Fonte da cena | Salve 1 em Avançado de uma fonte de luz | Faixa larga suavizada dentro do alcance |
| Zero | Volte o controle da luz a zero | Programa e aparência nativos restaurados |
| Camadas | Ajuste cor, saturação e contraste da luz | Todas as contribuições acompanham a faixa radial |
| Parede e porta | Coloque paredes e abra/feche uma porta | Recorte nativo preservado e shader acompanha o polígono |
| Direcional | Use uma luz de 90° e rotacione | Laterais rígidas, distância radial suavizada |
| Animação | Alterne Tocha, Pulsação e outras animações | Animação preservada, controle acompanha os shaders novos |
| Sobreposição | Configure duas luzes com bordas diferentes | Cada fonte contribui independentemente |
| Remoto | Edite a flag da luz em outro cliente | Atualização após salvar, sem mover nem recarregar |
| Fog e alcance | Compare exploração/detecção antes e depois | Alcance lógico e exploração inalterados |

Não marque estes testes como aprovados sem executá-los num mundo real da versão alvo. A validação disponível neste ambiente é isolada.
