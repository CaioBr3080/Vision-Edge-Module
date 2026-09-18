# Vision Edge Attenuation

Vision Edge Attenuation is a system-agnostic module for **Foundry VTT v13 and v14**. It adds an independent **Edge Attenuation** control after Foundry's native attenuation controls for token vision, token light, Prototype Token light, and ambient lights.

## Installation

Install from this manifest URL in Foundry's **Add-on Modules → Install Module** window:

```text
https://raw.githubusercontent.com/CaioBr3080/Vision-Edge-Module/main/module.json
```

Alternatively, download `vision-edge-attenuation.zip` from the latest GitHub release and extract it so the result is:

```text
Data/modules/vision-edge-attenuation/module.json
```

Restart Foundry and enable **Vision Edge Attenuation** in the world.

## Token vision

Open a Token or Prototype Token configuration, select **Vision**, and set **Edge Attenuation** from `0` to `1` in `0.05` steps.

`0` keeps Foundry's normal hard edge. Higher values soften only the final radial portion of the finite vision range:

- `0.25`: last 12.5%
- `0.5`: last 25%
- `1`: last 50%

Walls, doors, and cone sides remain hard. The module uses Foundry's existing wall-clipped polygon and never expands the range. Fog exploration, detection rules, and logical visibility retain their native range.

The setting is stored at:

```text
flags.vision-edge-attenuation.edgeAttenuation
```

## Token and ambient light

For a Token or Prototype Token, open **Light**. For an ambient light, open **Advanced**. The separate **Edge Attenuation** control is stored at:

```text
flags.vision-edge-attenuation.lightEdgeAttenuation
```

This affects the light's rendered contribution and the visual reveal mask, including cached ambient lights. It preserves Foundry's range, wall and cone clipping, coloration, native attenuation, animation, global illumination, darkness sources, and overlapping lights. Each light keeps its own setting; token vision and token light do not share a value.

Set the value to `0` to restore the original shader and native appearance.

## Macro example

Use the light flag in a Token update to set a torch and its edge attenuation together:

```js
const token = canvas.tokens.controlled[0];
if (!token) return ui.notifications.warn("Select a token first.");

await token.document.update({
  "light.bright": 2,
  "light.dim": 4,
  "light.color": "#ffcc66",
  "light.alpha": 0.6,
  "light.animation.type": "torch",
  "flags.vision-edge-attenuation.lightEdgeAttenuation": 0.7
});
```

## Compatibility

The module supports Foundry VTT v13 and v14 and was checked against v14.360. It uses native form fields, source polygons, visibility masks, and point-light shader instances. Custom shaders that do not follow Foundry's adaptive light shader structure are left unchanged and show a compatibility warning.

`persistentVision` does not expose the current-vision sampler needed for the separate visual texture, so vision edge attenuation is disabled in that mode without changing Foundry's native behavior.

## Development

```powershell
node --test
node tools/pack.mjs
node tools/serve-tests.mjs 'C:\Program Files\Foundry Virtual Tabletop\resources\app'
```

The test server exposes visual checks at `http://127.0.0.1:32113/tests/webgl.html` and `http://127.0.0.1:32113/tests/light-webgl.html`. The tests use the local Foundry installation for PIXI, cached-container, and native shaders; those Foundry assets are not distributed with this module.

See [the validation guide](docs/TESTING.md) for test details.
