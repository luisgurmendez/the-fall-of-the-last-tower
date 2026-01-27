# Ability Icon Style Guide

This document defines the visual style for all champion ability icons in Siege.

## API Configuration

**Endpoint:** `https://api.pixellab.ai/v2/generate-image-v2`
**API Key:** `c3b8e87c-b114-4eab-8651-64a2be5241c8`

## Base Prompt Template

Use this template as a wrapper for all ability icon generation:

```
{ABILITY_SPECIFIC_DESCRIPTION}, dark fantasy pixel art ability icon, black background
```

**Technical specs:**
- Size: 64x64 pixels
- Style: Dark fantasy pixel art
- Background: Black (solid)
- Palette: Limited colors with glowing accents

## cURL Command Template

### Basic (no palette enforcement)

```bash
curl -s -X POST https://api.pixellab.ai/v2/generate-image-v2 \
  -H "Authorization: Bearer c3b8e87c-b114-4eab-8651-64a2be5241c8" \
  -H "Content-Type: application/json" \
  -d '{
    "description": "{YOUR_PROMPT}, dark fantasy pixel art ability icon, black background",
    "image_size": {"width": 64, "height": 64}
  }' | jq -r '.images[0].base64' | base64 -d > output.png
```

### With Forced Palette (recommended for consistency)

Use `style_image` to provide a reference image containing the champion's color palette.
Use `style_options` to control what gets copied from the reference:

```bash
curl -s -X POST https://api.pixellab.ai/v2/generate-image-v2 \
  -H "Authorization: Bearer c3b8e87c-b114-4eab-8651-64a2be5241c8" \
  -H "Content-Type: application/json" \
  -d '{
    "description": "{YOUR_PROMPT}, dark fantasy pixel art ability icon, black background",
    "image_size": {"width": 64, "height": 64},
    "style_image": {
      "type": "base64",
      "base64": "{BASE64_ENCODED_PALETTE_IMAGE}",
      "format": "png"
    },
    "style_options": {
      "color_palette": true,
      "outline": false,
      "detail": false,
      "shading": false
    }
  }' | jq -r '.images[0].base64' | base64 -d > output.png
```

**Style Options:**
- `color_palette`: Copy colors from reference (set `true` for palette enforcement)
- `outline`: Copy outline style from reference
- `detail`: Copy detail level from reference
- `shading`: Copy shading style from reference

## Palette Reference Images

Store palette reference images for each champion to ensure color consistency across all abilities:

```
src/assets/abilities/{champion_name}/
├── palette.png        # 8x8 or 16x16 image with champion's colors
├── passive.png
├── q.png
├── w.png
├── e.png
└── r.png
```

**Creating a palette.png:**
1. Use an existing ability icon that has the correct colors
2. Or create a small (8x8 or 16x16) image containing swatches of the champion's colors
3. Include: primary color, accent color, glow/energy color, and black background

## Color Palettes by Champion Class

### Assassin (Vex)
- Primary: Deep purple (#3d1a5e), Shadow black (#1a0a2e)
- Accent: Toxic green (#7fff00), Blood red (#8b0000)
- Glow: Purple energy (#9932cc)

### Warrior (Gorath)
- Primary: Steel gray (#4a4a4a), Bronze (#cd7f32)
- Accent: Blood red (#8b0000), Fire orange (#ff4500)
- Glow: Golden energy (#ffd700)

### Mage (Magnus)
- Primary: Deep blue (#1a1a5e), Arcane purple (#4b0082)
- Accent: Electric blue (#00bfff), Ice white (#f0f8ff)
- Glow: Blue energy (#00ffff)

### Support (Elara)
- Primary: Forest green (#228b22), Earth brown (#8b4513)
- Accent: Golden light (#ffd700), Nature green (#32cd32)
- Glow: Holy/nature energy (#adff2f)

## Icon Composition Guidelines

| Ability Type | Visual Theme | Example Keywords |
|--------------|--------------|------------------|
| **Passive** | Emblem/symbol, subtle glow | "emblem", "mark", "symbol", "aura" |
| **Q** | Projectile/attack focused | "projectile", "strike", "bolt", "blade" |
| **W** | Defensive/utility | "shield", "barrier", "cloak", "aura" |
| **E** | Movement/positioning | "dash", "leap", "teleport", "trail" |
| **R (Ultimate)** | Dramatic, powerful | "explosion", "vortex", "mark", "energy burst" |

## Example Prompts by Champion

### Vex (Assassin)
- **Passive:** "Three glowing purple crescent marks stacked vertically"
- **Q:** "Four-pointed ninja star with purple shadow trail, dark metal blades with glowing edges"
- **W:** "Hooded assassin silhouette dissolving into purple smoke wisps, invisibility effect"
- **E:** "Diagonal purple streak with ghostly afterimage, speed lines, teleport trail"
- **R:** "Glowing purple crosshair target with dark energy swirling, ominous mark"

### Gorath (Warrior)
- **Passive:** "Burning fist with orange flames, rage emblem"
- **Q:** "Massive axe swing with fire trail, brutal strike"
- **W:** "Iron shield with glowing runes, defensive stance"
- **E:** "Charging bull silhouette with dust trail, unstoppable force"
- **R:** "Ground slam with shockwave, seismic explosion"

### Magnus (Mage)
- **Passive:** "Floating arcane orbs circling, blue magical energy"
- **Q:** "Blue lightning bolt with electric sparks"
- **W:** "Swirling ice barrier, frost shield"
- **E:** "Arcane portal with blue energy vortex"
- **R:** "Massive arcane explosion, blue energy nova"

### Elara (Support)
- **Passive:** "Golden healing aura, divine light rays"
- **Q:** "Nature vine whip with green energy"
- **W:** "Protective green barrier, nature shield"
- **E:** "Leaf tornado, swift nature dash"
- **R:** "Blooming flower with golden healing light burst"

## File Naming Convention

```
src/assets/abilities/{champion_name}/
├── passive.png
├── q.png
├── w.png
├── e.png
└── r.png
```

## Batch Generation Script

```bash
#!/bin/bash
API_KEY="c3b8e87c-b114-4eab-8651-64a2be5241c8"
CHAMPION="champion_name"
OUTPUT_DIR="src/assets/abilities/$CHAMPION"

mkdir -p $OUTPUT_DIR

# Basic generation (no palette enforcement)
generate_icon() {
  local name=$1
  local prompt=$2
  curl -s -X POST https://api.pixellab.ai/v2/generate-image-v2 \
    -H "Authorization: Bearer $API_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"description\": \"$prompt, dark fantasy pixel art ability icon, black background\", \"image_size\": {\"width\": 64, \"height\": 64}}" \
    | jq -r '.images[0].base64' | base64 -d > "$OUTPUT_DIR/$name.png"
  echo "Generated $name.png"
}

# Generation with forced palette (recommended)
generate_icon_with_palette() {
  local name=$1
  local prompt=$2
  local palette_image=$3  # Path to palette reference image

  # Encode palette image to base64
  local palette_b64=$(base64 < "$palette_image" | tr -d '\n')

  curl -s -X POST https://api.pixellab.ai/v2/generate-image-v2 \
    -H "Authorization: Bearer $API_KEY" \
    -H "Content-Type: application/json" \
    -d "{
      \"description\": \"$prompt, dark fantasy pixel art ability icon, black background\",
      \"image_size\": {\"width\": 64, \"height\": 64},
      \"style_image\": {
        \"type\": \"base64\",
        \"base64\": \"$palette_b64\",
        \"format\": \"png\"
      },
      \"style_options\": {
        \"color_palette\": true,
        \"outline\": false,
        \"detail\": false,
        \"shading\": false
      }
    }" | jq -r '.images[0].base64' | base64 -d > "$OUTPUT_DIR/$name.png"
  echo "Generated $name.png with palette from $palette_image"
}

# Example usage without palette:
# generate_icon "passive" "Your passive description here"

# Example usage with palette (recommended):
# generate_icon_with_palette "passive" "Your passive description here" "$OUTPUT_DIR/palette.png"
# generate_icon_with_palette "q" "Your Q ability description here" "$OUTPUT_DIR/palette.png"
# generate_icon_with_palette "w" "Your W ability description here" "$OUTPUT_DIR/palette.png"
# generate_icon_with_palette "e" "Your E ability description here" "$OUTPUT_DIR/palette.png"
# generate_icon_with_palette "r" "Your R ability description here" "$OUTPUT_DIR/palette.png"
```

## Tips for Good Prompts

1. **Be specific but not literal** - Describe the visual, not the game mechanic
2. **Use action words** - "swirling", "glowing", "bursting", "dissolving"
3. **Include material/texture** - "metal", "smoke", "energy", "flame"
4. **Keep it concise** - 10-20 words max for the ability-specific part
5. **Avoid text/letters** - Don't ask for letters or text in the icon
6. **Use palette enforcement** - Generate first icon without palette, then use it as `style_image` for remaining abilities to ensure color consistency across all icons for a champion
