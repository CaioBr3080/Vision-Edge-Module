# Vision Edge Attenuation

Vision Edge Attenuation is a system-agnostic module for **Foundry VTT v13 and v14**. It adds soft radial edges to native token vision and lighting while preserving walls, cone clipping, visibility rules, and Fog exploration.

## Installation

Install the module in Foundry with this package manifest URL:

```text
https://github.com/CaioBr3080/Vision-Edge-Module/releases/download/v0.3.0/module.json
```

Enable **Vision Edge Attenuation** in the target world after installation.

## World configuration

Open **Game Settings -> Configure Settings -> Vision Edge Attenuation -> Configure**.

The window provides these world-scoped settings:

- Default edge attenuation for token vision.
- Default edge attenuation for token and ambient lights.
- Fog of War edge attenuation. This only softens the visible boundary between explored and unexplored areas; it does not change exploration data, sight range, or detection.
- An option to show players a hold-to-measure button in an owned token's HUD.

Every eligible token vision source and light uses its world default. A token or ambient light can instead use its own value by enabling **Use a custom vision value** or **Use a custom light value** next to the corresponding Edge Attenuation control. Existing values from v0.2.x remain custom values after upgrading.

## Token controls

Open a Token or Prototype Token configuration:

- **Vision** contains Edge Attenuation and the priority checkbox for its vision.
- **Light** contains Edge Attenuation and the priority checkbox for its light.

For an ambient light, the light control and priority checkbox appear in its configuration. Values range from `0` to `1` in `0.05` steps. `0` retains Foundry's hard native edge. At `1`, the final half of the finite range fades.

## Quick measurement

When the GM enables the player option, players with permission to update an owned token see a ruler button in its Token HUD. Hold the button to render that token's vision as if its Edge Attenuation were `0`; release it to restore the normal visual edge. This is local and temporary: it never changes a token document, other players' views, Fog data, or sight calculations.

## Compatibility

The module supports Foundry VTT v13 and v14 and was checked against v14.360. It uses native source polygons, visibility masks, point-light shader instances, and the native Fog filter. Custom shaders that do not follow Foundry's adaptive light shader structure are left unchanged and show a compatibility warning.

Vision edge attenuation is unavailable with `persistentVision`, because Foundry does not expose its current-vision sampler in that mode. Fog edge attenuation remains a visual-only filter adjustment where the Foundry blur pipeline is enabled.

## Development

```powershell
node --test
node tools/pack.mjs
node tools/serve-tests.mjs 'C:\Program Files\Foundry Virtual Tabletop\resources\app'
```
