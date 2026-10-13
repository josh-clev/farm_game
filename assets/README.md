# Replaceable graphics

The game automatically looks for each graphic as a PNG first and then as a JPG.
Keep the base filename below unchanged when replacing artwork; no code edits are needed.

- `grass-background.png` or `grass-background.jpg`
- `plot.png` or `plot.jpg`
- `next-turn-button.png` or `next-turn-button.jpg`
- `wheat_crop.png` or `wheat_crop.jpg`
- `corn_crop.png` or `corn_crop.jpg`
- `sugarcane_crop.png` or `sugarcane_crop.jpg`
- `cotton_crop.png` or `cotton_crop.jpg`
- `tomato_crop.png` or `tomato_crop.jpg`
- `watering-can.png` or `watering-can.jpg`
- `garden-scissors.png` or `garden-scissors.jpg`
- `wheat_icon.png` or `wheat_icon.jpg`
- `corn_icon.png` or `corn_icon.jpg`
- `sugarcane_icon.png` or `sugarcane_icon.jpg`
- `cotton_icon.png` or `cotton_icon.jpg`
- `tomato_icon.png` or `tomato_icon.jpg`

Resource icons are intentionally separate from the matching field crop artwork, so inventory and plant graphics can be replaced independently.

Suggested dimensions:

- Background: 1536 x 2048 portrait
- Plot and button: at least 512 x 512, with transparent backgrounds when appropriate
- Crops: 256 x 256 with a transparent background

If neither file type is present, the built-in lightweight CSS or emoji fallback is used.
