# Pipeline e decisões técnicas

A versão 0.1.1 habilita as gerações 13 e 14. A instalação local 14.360 usa os mesmos pontos de extensão usados pelo módulo: `visibilityRefresh`, renderização secundária de `CanvasVisionMask`, `VisibilityFilter.apply()` e os formulários nativos de token/protótipo. Foi conferida também a inicialização de `PIXI.BLEND_MODES.MAX_COLOR` em `client/canvas/board.mjs` e a submissão das flags em `client/applications/sheets/token/prototype-config.mjs`. A versão 0.1.0 restringia a instalação à v13 e por isso não podia ser ativada no Foundry 14.360 do ambiente.

## Fontes examinadas

O projeto original não incluía o código do Foundry. A instalação local em `C:/Program Files/Foundry Virtual Tabletop/resources/app` é **14.360**, conforme seu `package.json`. Foram lidos:

- `client/canvas/sources/point-vision-source.mjs`
- `client/canvas/groups/visibility.mjs`
- `client/canvas/layers/masks/vision.mjs`
- `client/canvas/containers/advanced/cached-container.mjs`
- `client/canvas/rendering/filters/visibility.mjs`
- `client/applications/sheets/token/token-config.mjs`
- `common/data/fields.mjs` e `templates/scene/token/vision.hbs`

Não se afirma que esses arquivos sejam código da v13. As classes, propriedades e pontos de extensão foram cruzados com a API oficial da **13.350**:

- [PointVisionSource](https://foundryvtt.com/api/v13/classes/foundry.canvas.sources.PointVisionSource.html): `los`, `fov`, `radius`, `light`, `lightRadius`, `_createRestrictedPolygon()`.
- [CanvasVisibility](https://foundryvtt.com/api/v13/classes/foundry.canvas.groups.CanvasVisibility.html): `vision`, `refreshVisibility()` e hook `visibilityRefresh`.
- [CanvasVisionMask](https://foundryvtt.com/api/v13/classes/foundry.canvas.layers.CanvasVisionMask.html): textura original e métodos herdados `createRenderTexture({renderFunction, clearColor})`, `removeRenderTexture()`, `renderDirty`.
- [CachedContainer](https://foundryvtt.com/api/v13/classes/foundry.canvas.containers.CachedContainer.html): renderização secundária e redimensionamento das texturas.
- [VisibilityFilter](https://foundryvtt.com/api/v13/classes/foundry.canvas.rendering.filters.VisibilityFilter.html): `visionTexture`, `apply()` e composição de fog.
- [TokenConfig](https://foundryvtt.com/api/v13/classes/foundry.applications.sheets.TokenConfig.html) e [PrototypeTokenConfig](https://foundryvtt.com/api/v13/classes/foundry.applications.sheets.PrototypeTokenConfig.html): aplicações distintas, com acesso ao token de prévia/protótipo; o protótipo pode retornar uma Promise.

## Separação das bordas

`PointVisionSource.los` representa a linha de visão sem a restrição radial finita. `_createRestrictedPolygon()` restringe esse polígono pelo raio da fonte. O resultado `shape` já contém paredes, ângulo e alcance. Triangular esse resultado e aplicar `distance(position, origin) / radius` preserva os cortes rígidos e modula somente a faixa radial final. Não se aplica blur nem se dilata qualquer geometria.

## Separação visual e lógica

O código local revela que `CanvasVisibility.refreshVisibility()` desenha `vision.sight`, desenha a percepção de luz em `vision.light.mask`, chama `visibilityRefresh` e depois faz o commit do fog. Alterar a máscara original nesse hook também poderia alterar exploração. Por isso, o hook serve exclusivamente para atualizar os meshes de uma textura **secundária**, criada pela API de CachedContainer.

O container dos meshes pertence a `canvas.masks.vision`, para receber os mesmos transforms; seu `renderable` permanece falso na passagem primária. A callback secundária desenha, nesta ordem, a percepção de luz nativa, os meshes de FOV e a eliminação por escuridão nativa. A textura só é atualizada quando a máscara nativa é marcada como suja. O redimensionamento vem do CachedContainer.

Uma subclasse da classe configurada em `CONFIG.Canvas.visibilityFilter` envolve somente `apply()`. Ela troca `uniforms.visionTexture` pela textura secundária durante a aplicação e restaura o original em `finally`, preservando argumentos, retorno, shader e filtros já herdados. Não há substituição de métodos inteiros nem patch de protótipos. Os samplers usados pelas camadas de iluminação e detecção continuam apontando para a textura original.

## Limitações identificadas

No ramo `persistentVision`, o filtro compõe o fog a partir da exploração e não lê o sampler de visão atual. A troca desse sampler não teria efeito; modificar a exploração violaria o requisito. O módulo desativa o efeito e avisa.

A máscara de percepção de luz nativa é independente do FOV finito e pode revelar áreas dentro e fora da faixa de atenuação. Desde a 0.2.1, a cópia visual também atenua fontes de luz pelo raio e pela flag da própria luz. A máscara lógica permanece intacta; a percepção não é limitada pelo raio de FOV do token.

A estrutura interna dos containers `vision.light` e `vision.darkness` precisa ser validada na sessão real da v13. A API confirma as classes e a renderização secundária, mas não documenta cada operação de shader e stencil. Guardas verificam a estrutura; em incompatibilidade, o módulo deixa de trocar o sampler, avisa e preserva o comportamento nativo.

## Borda das fontes de luz — versão 0.2.0

Foram examinados também `client/canvas/sources/base-light-source.mjs`, `rendered-effect-source.mjs`, `point-light-source.mjs`, os shaders `lighting/base-lighting.mjs`, `illumination-lighting.mjs`, `coloration-lighting.mjs`, `background-lighting.mjs`, as animações `effects/torch.mjs` e `effects/pulse.mjs`, `AmbientLightConfig` e os templates de luz do token e de fonte ambiente na instalação **14.360**. Referências públicas: [PointLightSource v13](https://foundryvtt.com/api/v13/classes/foundry.canvas.sources.PointLightSource.html) e [lightingRefresh v14](https://foundryvtt.com/api/v14/functions/hookEvents.lightingRefresh.html).

Os hooks `initializePointLightSourceShaders` e `lightingRefresh` atualizam as instâncias de shader já existentes. O programa GLSL recebe um uniform independente e um multiplicador radial de `depth` imediatamente antes da saída nativa. `vUvs` é calculado pelo shader nativo como `aVertexPosition * 0.5 + 0.5`; a distância normalizada é `distance(vUvs, vec2(0.5)) * 2.0`. A largura máxima mantém o mesmo cálculo de 50% usado na visão.

Modificar `depth` preserva a mistura `mix(computedBackgroundColor, finalColor, depth)` da iluminação, a contribuição `finalColor * depth` da coloração e a opacidade dos ajustes de fundo. A geometria de paredes e cones não muda. Cada shader mantém sua classe, métodos, getters e uniforms de animação. Não há wrapper de método interno do Foundry para esta adição.

Os programas modificados são reutilizados por programa original via WeakMap. O shader original volta a ser usado ao zerar o controle. O código remove o `#define SHADER_NAME` gerado por PIXI antes de criar um novo Program para evitar redefinição de macro. Se a instância estiver vinculada ao renderer, a troca de programa primeiro descarrega o batch e invalida a vinculação no ShaderSystem, evitando sincronização de uniforms contra um programa ainda não vinculado.

Todas as camadas da fonte são verificadas antes de aplicar a troca. Shaders sem o padrão adaptativo esperado fazem a fonte inteira voltar ao programa nativo e emitem um aviso. Fontes de escuridão e iluminação global não recebem uma flag de atenuação. A flag de luz é salva pelo mesmo formulário nativo, usando `light.attenuation` como âncora no token e `config.attenuation` na fonte de luz. Atualizações remotas dessa flag solicitam `refreshLighting` e `refreshVision`.

## Correção da revelação por luz — versão 0.2.1

Os shaders de iluminação não controlam a revelação do cenário pelo filtro de visibilidade. `refreshVisibility()` também desenha polígonos rígidos em `vision.light.sources`, `preview` e no Sprite `cached`; esses polígonos preenchiam a faixa atenuada. A 0.2.1 ativa a textura visual secundária também quando apenas uma flag de luz está habilitada. Adiciona meshes radiais para todas as luzes pontuais ativas (inclusive luzes com flag zero, para preservar sua contribuição), sob `vision.light`, ocultos na passagem primária.

Durante a callback secundária, os três containers de luz pontual nativos ficam temporariamente com `renderable=false`, enquanto o container dos meshes fica ativo. Renderizar `vision.light` preserva automaticamente seu stencil `mask`, inclusive luzes que fornecem visão, assim como o container de luz global. O `finally` restaura cada valor anterior. O cache nativo nunca é modificado ou invalidado pelo efeito, e o commit do fog continua usando os containers originais. A liberação destrói apenas os recursos do módulo.
