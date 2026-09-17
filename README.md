# Vision Edge Attenuation

Módulo independente de sistema para **Foundry VTT v13 e v14**. Adiciona **Atenuação da Borda / Edge Attenuation** imediatamente depois da atenuação nativa nos menus de visão, iluminação do token/Prototype Token e fontes de luz da cena.

## Instalação

1. Extraia `dist/vision-edge-attenuation-0.2.1.zip` na pasta `Data/modules` do seu Foundry. O resultado deve ser `Data/modules/vision-edge-attenuation/module.json`.
2. Reinicie o Foundry para descobrir o módulo e ative **Vision Edge Attenuation** no mundo.
3. Abra a configuração de um token, entre em **Visão** e ajuste **Atenuação da Borda** entre 0 e 1, em passos de 0,05. Salve para atualizar a visão de todos os clientes.

Também é possível copiar `module.json`, `scripts`, `lang`, `docs` e este README para uma pasta chamada `vision-edge-attenuation` em `Data/modules`. Nenhuma compilação, biblioteca adicional ou libWrapper é necessária.

## Iluminação do token e fontes de luz

Na configuração do token ou do Prototype Token, abra **Iluminação** e procure **Atenuação da Borda** junto da atenuação nativa. Na configuração de uma fonte de luz da cena, abra **Avançado**. Os controles têm a mesma faixa 0–1 e passo 0,05 usados na visão.

O controle da luz salva `flags.vision-edge-attenuation.lightEdgeAttenuation`, independente de `edgeAttenuation` da visão. Cada fonte tem seu valor; luz do token e visão do mesmo token podem ter valores diferentes. O protótipo transmite ambas as flags para os novos tokens. Salvar atualiza a iluminação nos clientes conectados, sem mover a fonte.

O efeito suaviza para dentro o limite radial da maior distância entre luz fraca e forte. Usa as camadas e os polígonos nativos, preservando ângulo, paredes, cores, atenuação nativa e animações. Na camada de iluminação, a transição converge para a iluminação de fundo da cena; nas camadas de cor e ajustes, reduz a contribuição da própria fonte. Não apaga outras luzes sobrepostas.

A versão 0.2.1 também suaviza a máscara visual que revela o cenário pela luz. A versão 0.2.0 alterava apenas os shaders da iluminação e ainda deixava uma borda rígida na revelação. A correção cobre a luz do token e o cache de fontes fixas da cena, usando o recorte nativo de linha de visão. Luzes sobrepostas usam a maior visibilidade e a iluminação global continua nativa.

O valor zero restaura o programa de shader original. Iluminação global e fontes de escuridão permanecem nativas. A lógica de alcance, detecção e exploração do fog não muda com o novo controle de luz. Shaders personalizados que não usam o padrão adaptativo `vUvs`/`depth` mantêm a fonte inteira no modo nativo, com aviso.

## Funcionamento

O valor zero usa a textura visual original do Foundry e não mantém recursos gráficos adicionais. Valores maiores criam uma transição suave **para dentro** do alcance: 0,25 suaviza os últimos 12,5%; 0,5, os últimos 25%; 1, os últimos 50%. O centro permanece intacto. A atenuação nativa continua independente.

O shader desenha o polígono de visão calculado pelo próprio Foundry. Paredes, portas e laterais do cone continuam recortando esse polígono com bordas rígidas; apenas a distância radial modula a opacidade. Quando duas visões se sobrepõem, prevalece a maior visibilidade naquele ponto.

A flag `flags.vision-edge-attenuation.edgeAttenuation` é salva pelo formulário nativo. O formulário do Prototype Token salva a mesma flag no protótipo; a criação normal de tokens herda seus dados. Atualizações remotas da flag solicitam uma atualização de percepção em cada cliente, sem exigir permissões de GM para renderizar.

## Iluminação e fog

A textura original, os polígonos de detecção e `canvas.fog.commit()` não são alterados. A textura adicional é usada apenas pelo filtro que compõe visualmente o fog. Assim, a exploração mantém o alcance lógico completo, inclusive a faixa atenuada. A transição termina na aparência normal da área fora da visão atual: preto em regiões não exploradas ou a cor de fog explorado configurada na cena.

A percepção de luz do Foundry é preservada. Uma área iluminada que já é legitimamente visível pode continuar visível além do alcance finito de visão no escuro, e pode preencher a faixa atenuada. Para observar o efeito isoladamente, teste numa cena sem iluminação global ou luzes. O módulo não impõe um limite adicional à percepção de luz.

## Compatibilidade e limites

- Suporte: v13 e v14, com API pública da 13.350 e código local da **14.360** conferidos. O manifesto usa `verified: "14.360"` para essa versão examinada e testada isoladamente; não representa uma certificação de todos os testes de integração.
- A versão 0.2.0 adiciona o controle de borda de iluminação. A versão 0.1.1 corrigiu o bloqueio de instalação e de renderização na v14, presente na 0.1.0. O efeito visual fica desativado fora das gerações 13–14.
- A validação numa sessão real, com atores, jogador remoto, portas e fog persistido, ainda precisa ser executada. Consulte [o roteiro de aceitação](docs/TESTING.md).
- Vision Modes mantêm seus shaders e características. A suavização atinge o FOV finito; modos especiais de detecção de tokens não ganham um alcance visual novo.
- `canvas.visibilityOptions.persistentVision` não oferece o sampler separado de visão atual utilizado aqui. O efeito é desativado com aviso nesse caso.
- Módulos que substituem o pipeline de visão, usam formas sem `shape.points` ou substituem o filtro depois da inicialização podem impedir a integração. Não há fallback que suavize paredes. Dependências ausentes no pipeline geram aviso e preservam a visão nativa.

## Desenvolvimento

Requer Node.js para os testes e empacotamento, mas não para usar o módulo.

```powershell
node --test
node tools/pack.mjs
node tools/serve-tests.mjs 'C:\Program Files\Foundry Virtual Tabletop\resources\app'
```

O último comando disponibiliza `http://127.0.0.1:32113/tests/webgl.html` (visão) e `http://127.0.0.1:32113/tests/light-webgl.html` (iluminação). Ele usa PIXI, CachedContainer e shaders da instalação local, sem distribuí-los. Os testes salvam os resultados em `test-results/webgl.json` e `test-results/light-webgl.json`. As páginas contêm polígonos mínimos e testes de pixels; não substituem um mundo real do Foundry. Encerre o servidor com Ctrl+C.

Ative `DEBUG` em `scripts/common.js` para registrar atualizações de visão. A implementação reutiliza programas, meshes e textura; refaz geometria somente quando o polígono muda e usa a renderização secundária nativa para acompanhar atualizações e movimentos de câmera, sem ticker adicional.

Veja [as notas sobre o pipeline](docs/PIPELINE.md) para os pontos de extensão e referências.
