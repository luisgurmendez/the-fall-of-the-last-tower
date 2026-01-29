# PixelLab AI - Pixel Art Generation Guide

This document provides a reference for using PixelLab AI to generate pixel art assets for Siege.

> **MCP Integration**: We have the PixelLab MCP server installed, which provides direct tool access for character creation, animations, tilesets, and more.

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [MCP Tools Reference](#mcp-tools-reference)
3. [Character Creation](#character-creation)
4. [Animations](#animations)
5. [Tilesets](#tilesets)
6. [Isometric Tiles](#isometric-tiles)
7. [Map Objects](#map-objects)
8. [Image Generation (REST API)](#image-generation-rest-api)
9. [Size Constraints & Limits](#size-constraints--limits)
10. [Style Parameters](#style-parameters)
11. [Best Practices](#best-practices)
12. [Project-Specific Styles](#project-specific-styles)

---

## Quick Start

PixelLab operations are **asynchronous**. The typical workflow is:

1. **Submit** a creation request → receive a job/asset ID immediately
2. **Wait** for processing (2-5 minutes typical)
3. **Retrieve** the completed asset using the corresponding `get_*` tool

```
create_character → get_character
create_topdown_tileset → get_topdown_tileset
create_isometric_tile → get_isometric_tile
animate_character → get_character (animations appear on the character)
```

---

## MCP Tools Reference

### Character Tools

| Tool | Description |
|------|-------------|
| `create_character` | Generate character sprites with 4 or 8 directional views |
| `animate_character` | Apply template animations to existing characters |
| `get_character` | Retrieve character data, images, animations, and download links |
| `list_characters` | List all created characters (supports tag filtering) |
| `delete_character` | Delete a character and all associated data |

### Tileset Tools

| Tool | Description |
|------|-------------|
| `create_topdown_tileset` | Generate Wang tilesets (16-23 tiles) for top-down games |
| `get_topdown_tileset` | Retrieve completed tileset with PNG and metadata |
| `list_topdown_tilesets` | List all top-down tilesets |
| `delete_topdown_tileset` | Delete a tileset |
| `create_sidescroller_tileset` | Generate platform tiles for 2D games |
| `get_sidescroller_tileset` | Retrieve sidescroller tileset |
| `list_sidescroller_tilesets` | List sidescroller tilesets |
| `delete_sidescroller_tileset` | Delete sidescroller tileset |

### Other Tools

| Tool | Description |
|------|-------------|
| `create_isometric_tile` | Generate single isometric tiles |
| `get_isometric_tile` | Retrieve isometric tile |
| `list_isometric_tiles` | List isometric tiles |
| `delete_isometric_tile` | Delete isometric tile |
| `create_map_object` | Generate objects with transparent backgrounds |
| `get_map_object` | Retrieve map object |

---

## Character Creation

### Parameters

```
description: Character appearance (e.g., "cute wizard with blue robes")
n_directions: 4 (cardinal) or 8 (includes diagonals)
size: Canvas size in pixels (16-128). Character is ~60% of canvas height.
name: Optional name for reference
view: "low top-down" | "high top-down" | "side"
```

### Proportions (Presets)

| Preset | Description |
|--------|-------------|
| `default` | Standard proportions |
| `chibi` | Large head, small body |
| `cartoon` | Exaggerated features |
| `stylized` | Artistic interpretation |
| `realistic_male` | Realistic male proportions |
| `realistic_female` | Realistic female proportions |
| `heroic` | Muscular, powerful build |

Custom proportions can also be specified:
```json
{
  "type": "custom",
  "head_size": 1.5,
  "arms_length": 0.8,
  "legs_length": 0.9,
  "shoulder_width": 0.7,
  "hip_width": 0.8
}
```
(All values 0.5-2.0)

### Style Options

| Parameter | Options |
|-----------|---------|
| `outline` | "single color black outline", "single color outline", "selective outline", "lineless" |
| `shading` | "flat shading", "basic shading", "medium shading", "detailed shading" |
| `detail` | "low detail", "medium detail", "high detail" |
| `ai_freedom` | 100-999 (100=strict to prompt, 999=creative) |

### Example

```
Create a warrior character:
- description: "armored knight with red cape and golden sword"
- n_directions: 8
- size: 48
- proportions: {"type": "preset", "name": "heroic"}
- outline: "single color black outline"
- shading: "basic shading"
```

---

## Animations

### Template Animations

Apply pre-defined animations to existing characters:

**Movement:**
- `walking`, `walking-4-frames`, `walking-6-frames`, `walking-8-frames`
- `running-4-frames`, `running-6-frames`, `running-8-frames`
- `crouched-walking`, `sad-walk`, `scary-walk`

**Actions:**
- `breathing-idle`, `fight-stance-idle-8-frames`
- `jumping-1`, `jumping-2`, `running-jump`, `two-footed-jump`
- `crouching`, `getting-up`, `falling-back-death`

**Combat:**
- `lead-jab`, `cross-punch`, `high-kick`, `roundhouse-kick`
- `hurricane-kick`, `flying-kick`, `leg-sweep`, `surprise-uppercut`
- `taking-punch`, `fireball`, `throw-object`

**Other:**
- `drinking`, `picking-up`, `pushing`, `pull-heavy-object`
- `running-slide`, `backflip`, `front-flip`

### Custom Action Description

Override default animation with a custom description:
```
action_description: "walking stealthily" or "running quickly"
```
Focus on movement/pose only, avoid environmental details.

---

## Tilesets

### Top-Down (Wang) Tilesets

Creates 16-23 tiles for seamless terrain transitions.

```
lower_description: Base terrain (e.g., "ocean water", "dirt path")
upper_description: Elevated terrain (e.g., "sandy beach", "grass")
transition_description: Blending (e.g., "wet sand with foam") - required if transition_size > 0
transition_size: 0.0 (sharp) to 1.0 (full tile transition)
tile_size: {width: 16, height: 16} or {width: 32, height: 32}
view: "low top-down" | "high top-down"
```

### Chaining Tilesets

Create connected tilesets using base tile IDs:

1. Create first tileset (ocean → beach) → get beach base tile ID
2. Use beach ID as `lower_base_tile_id` for next tileset (beach → grass)
3. Continue chaining for consistent visual style

### Sidescroller Tilesets

For 2D platformer games with transparent backgrounds:

```
lower_description: Platform material (e.g., "stone brick", "wooden planks")
transition_description: Surface layer (e.g., "grass", "snow cover", "moss")
transition_size: 0.0 (no surface) to 0.5 (heavy surface layer)
```

---

## Isometric Tiles

Single isometric tiles for block-based games.

```
description: "grass on top of dirt" or "stone brick wall with moss"
size: 16-64 pixels (32+ recommended for better quality)
tile_shape: "thin tile" (~10%), "thick tile" (~25%), "block" (~50%)
seed: Optional, for reproducible generation
```

---

## Map Objects

Objects with transparent backgrounds for game maps.

### Basic Mode (no background)
```
description: "wooden barrel" or "stone fountain"
width: 32-400 pixels
height: 32-400 pixels
view: "low top-down" | "high top-down" | "side"
```

### Style Matching Mode (with background)
Provide a background image for the AI to match style:
```
background_image: {"type": "path", "path": "assets/my-map.png"}
inpainting: {"type": "oval", "percentage": 0.6} (default)
```

Inpainting options:
- `oval` - Centered oval mask (good for trees, pots, rocks)
- `rectangle` - Centered rectangle mask (good for buildings, chests)
- `mask` - Custom mask image (white=generate, black=frozen context)

---

## Image Generation (REST API)

For direct image generation (ability icons, etc.), use the REST API.

**Endpoint:** `https://api.pixellab.ai/v2/generate-image-v2`

See `src/assets/abilities/STYLE_GUIDE.md` for ability icon generation including:
- Base prompt templates
- cURL command examples
- Palette enforcement with `style_image`
- Champion-specific color palettes

---

## Size Constraints & Limits

| Asset Type | Min Size | Max Size | Notes |
|------------|----------|----------|-------|
| Characters | 16px | 128px | Character is ~60% of canvas |
| Standard images | 16px | 400px | Per dimension |
| Tileset tiles | 16px | 32px | Usually 16 or 32 |
| Isometric tiles | 16px | 64px | 32+ recommended |
| Map objects | 32px | 400px | Basic: 160K total pixels, Inpainting: 36K |

---

## Style Parameters

### Text Guidance Scale
Controls how closely the AI follows the text description.
- Range: 1-20
- Default: 8
- Higher = stricter adherence to prompt

### Shading Options

| Level | Description |
|-------|-------------|
| flat shading | No gradients, solid colors |
| basic shading | Simple highlights/shadows |
| medium shading | More depth and dimension |
| detailed shading | Rich lighting and depth |
| highly detailed shading | Maximum shading complexity |

### Outline Options

| Style | Description |
|-------|-------------|
| single color black outline | Classic pixel art outline |
| single color outline | Single color, not necessarily black |
| selective outline | Outlines only where needed |
| lineless | No outlines, colors meet directly |

### Detail Levels

| Level | Description |
|-------|-------------|
| low detail | Simple, minimal features |
| medium detail | Balanced detail |
| high detail | Rich, detailed sprites |

---

## Best Practices

### Prompts

1. **Be specific but visual** - Describe appearance, not game mechanics
2. **Use action words** - "swirling", "glowing", "bursting", "dissolving"
3. **Include materials** - "metal", "smoke", "energy", "flame"
4. **Keep it concise** - 10-20 words for the main description
5. **Avoid text/letters** - Don't request letters or text in images

### Consistency

1. **Use seeds** - Same seed + same params = reproducible results
2. **Chain tilesets** - Use base tile IDs for connected terrain
3. **Style matching** - Provide background images for consistent style
4. **Palette enforcement** - Use `style_image` with `color_palette: true`

### Performance

1. **Queue multiple jobs** - Don't wait for completion, queue then check
2. **Start small** - Test with smaller sizes, scale up when satisfied
3. **Use 32px+ for isometric** - Better quality at larger sizes

---

## Project-Specific Styles

### Ability Icons

For Siege ability icons, see the complete style guide at:
```
src/assets/abilities/STYLE_GUIDE.md
```

Key specifications:
- **Size:** 64x64 pixels
- **Style:** Dark fantasy pixel art
- **Background:** Black (solid)
- **Base prompt:** `{DESCRIPTION}, dark fantasy pixel art ability icon, black background`

Champion palettes are defined for: Vex (Assassin), Gorath (Warrior), Magnus (Mage), Elara (Support), Lume (Mage).

### Character Sprites

For MOBA champion sprites, recommended settings:
- **Size:** 48-64px canvas (character ~29-38px tall)
- **Directions:** 8 (full rotation for smooth movement)
- **View:** "low top-down" (matches MOBA perspective)
- **Proportions:** "heroic" for warriors, "stylized" for mages

---

## Processing Times

| Asset Type | Typical Time |
|------------|--------------|
| Character (4 dir) | 2-3 minutes |
| Character (8 dir) | 3-5 minutes |
| Animation | 2-4 minutes |
| Tileset | ~100 seconds |
| Isometric tile | 10-20 seconds |
| Map object | 15-30 seconds |

---

## Resources

- **MCP Token:** https://api.pixellab.ai/mcp
- **API v2 Docs:** https://api.pixellab.ai/v2/docs
- **LLM Reference:** https://api.pixellab.ai/v2/llms.txt
- **Community Discord:** Available via pixellab.ai
