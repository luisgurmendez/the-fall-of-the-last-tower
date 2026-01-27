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

```bash
curl -s -X POST https://api.pixellab.ai/v2/generate-image-v2 \
  -H "Authorization: Bearer c3b8e87c-b114-4eab-8651-64a2be5241c8" \
  -H "Content-Type: application/json" \
  -d '{
    "description": "{YOUR_PROMPT}, dark fantasy pixel art ability icon, black background",
    "image_size": {"width": 64, "height": 64}
  }' | jq -r '.images[0].base64' | base64 -d > output.png
```

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

# Example usage:
# generate_icon "passive" "Your passive description here"
# generate_icon "q" "Your Q ability description here"
# generate_icon "w" "Your W ability description here"
# generate_icon "e" "Your E ability description here"
# generate_icon "r" "Your R ability description here"
```

## Tips for Good Prompts

1. **Be specific but not literal** - Describe the visual, not the game mechanic
2. **Use action words** - "swirling", "glowing", "bursting", "dissolving"
3. **Include material/texture** - "metal", "smoke", "energy", "flame"
4. **Keep it concise** - 10-20 words max for the ability-specific part
5. **Avoid text/letters** - Don't ask for letters or text in the icon
