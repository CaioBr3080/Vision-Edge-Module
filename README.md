# Vision Edge Attenuation

Vision Edge Attenuation is a system-agnostic module for **Foundry VTT v13 and v14**. It adds soft radial edges to native token vision and lighting while preserving walls, cone clipping, visibility rules, and Fog exploration.

## Installation

Install the module in Foundry with this package manifest URL:

```text
https://github.com/CaioBr3080/Vision-Edge-Module/releases/download/v0.3.1/module.json
```

Enable **Vision Edge Attenuation** in the target world after installation.

## World configuration

Open **Game Settings -> Configure Settings -> Vision Edge Attenuation -> Configure**.

The configuration window has three values from `0` to `1`, in steps of `0.05`:

| Setting | Applies to | Result |
| --- | --- | --- |
| Default vision edge attenuation | Token vision | Used by every token that does not have a custom vision value. |
| Default light edge attenuation | Token lights and ambient lights | Used by every light that does not have a custom light value. |
| Fog edge attenuation | Fog of War | Softens the visual border between explored and unexplored areas. It never changes exploration data, sight range, detection, or wall blocking. |

A value of `0` keeps Foundry's hard native edge. At `1`, the final half of the finite vision or light range fades.

## Custom values and priority

A token or ambient light normally inherits the corresponding world default. Its configuration can override that default:

1. Open a **Token**, **Prototype Token**, or **Ambient Light** configuration.
2. Set the desired **Edge Attenuation** value in the **Vision** or **Light** section.
3. Enable **Use a custom vision value** or **Use a custom light value**.

When the checkbox is disabled, the slider is locked and the source follows the world setting. When it is enabled, that source's slider has priority and replaces the global value for that source only. Token vision and token light are independent: a token can override one while inheriting the other.

Values stored by v0.2.x are treated as custom values after upgrading, preserving their existing appearance.

## Where each control appears

- **Token / Prototype Token -> Vision:** vision Edge Attenuation and **Use a custom vision value**.
- **Token / Prototype Token -> Light:** light Edge Attenuation and **Use a custom light value**.
- **Ambient Light configuration:** light Edge Attenuation and **Use a custom light value**.

The global defaults immediately refresh the scene after they are saved. A source with a custom value refreshes when its own configuration is saved.

## Compatibility

The module supports Foundry VTT v13 and v14 and was checked against v14.360. It uses native source polygons, visibility masks, point-light shader instances, and the native Fog filter. Custom shaders that do not follow Foundry's adaptive light shader structure are left unchanged and show a compatibility warning.

Vision edge attenuation is unavailable with `persistentVision`, because Foundry does not expose its current-vision sampler in that mode. Fog edge attenuation remains a visual-only filter adjustment where the Foundry blur pipeline is enabled.

## Development

```powershell
node --test
node tools/pack.mjs
node tools/serve-tests.mjs 'C:\Program Files\Foundry Virtual Tabletop\resources\app'
```
