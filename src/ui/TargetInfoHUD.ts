/**
 * TargetInfoHUD - Displays information about the currently selected entity.
 *
 * Shows in the top-left corner when an entity is selected via left-click:
 * - Champion: Full panel with portrait, stats, abilities, items, buffs
 * - Minion: Simple panel with type and health bar
 * - Tower: Simple panel with tier/lane and health bar
 * - Jungle: Simple panel with creature name and health bar
 */

import { ScreenEntity } from '@/core/GameObject';
import RenderElement from '@/render/renderElement';
import RenderUtils from '@/render/utils';
import GameContext from '@/core/gameContext';
import type { OnlineStateManager, InterpolatedEntity } from '@/core/OnlineStateManager';
import type { OnlineInputHandler } from '@/core/input/OnlineInputHandler';
import {
  EntityType,
  type ChampionSnapshot,
  type MinionSnapshot,
  type TowerSnapshot,
  type JungleCreatureSnapshot,
  getChampionDefinition,
} from '@siege/shared';

/** Panel configuration - LARGER sizes for better readability */
const PANEL = {
  margin: 12,
  padding: 12,
  borderRadius: 6,
  // Champion panel - much bigger
  championWidth: 420,
  championHeight: 240,
  // Simple panel (minion, tower, jungle)
  simpleWidth: 240,
  simpleHeight: 80,
  // Health bar
  healthBarHeight: 20,
  healthBarMargin: 6,
  // Ability icons
  abilityIconSize: 44,
  abilityIconGap: 6,
  // Stats
  statLineHeight: 22,
  portraitSize: 72,
  // Items
  itemSize: 32,
  itemGap: 4,
};

/** Font sizes - MUCH BIGGER */
const FONT = {
  title: 24,
  large: 20,
  medium: 18,
  normal: 16,
  small: 14,
};

/** Colors */
const COLORS = {
  background: 'rgba(20, 20, 35, 0.95)',
  border: '#3a3a5c',
  borderHighlight: '#5a5a8c',
  text: '#ffffff',
  textDim: '#aaaaaa',
  healthBar: '#2ecc71',
  healthBarBg: '#1a472a',
  healthBarEnemy: '#e74c3c',
  healthBarEnemyBg: '#4a1a1a',
  manaBar: '#3498db',
  manaBarBg: '#1a3a4a',
  gold: '#ffd700',
  // Entity type accent colors
  championAlly: '#3498db',
  championEnemy: '#e74c3c',
  minion: '#8b7355',
  tower: '#708090',
  jungle: '#228b22',
};

interface TargetInfoHUDConfig {
  stateManager: OnlineStateManager;
  inputHandler: OnlineInputHandler;
  localSide: number;
}

export class TargetInfoHUD extends ScreenEntity {
  private stateManager: OnlineStateManager;
  private inputHandler: OnlineInputHandler;
  private localSide: number;

  constructor(config: TargetInfoHUDConfig) {
    super('target-info-hud');
    this.stateManager = config.stateManager;
    this.inputHandler = config.inputHandler;
    this.localSide = config.localSide;
  }

  step(ctx: GameContext): void {
    // No update logic needed - we read selection from inputHandler each frame
  }

  render(): RenderElement {
    return this.createOverlayRender((ctx: GameContext) => {
      const selectedId = this.inputHandler.getSelectedEntityId();
      if (!selectedId) return;

      const entity = this.stateManager.getEntity(selectedId);
      if (!entity) return;

      const { canvasRenderingContext: c } = ctx;

      // Determine entity type and render appropriate panel
      switch (entity.snapshot.entityType) {
        case EntityType.CHAMPION:
          this.renderChampionPanel(c, entity);
          break;
        case EntityType.MINION:
          this.renderMinionPanel(c, entity);
          break;
        case EntityType.TOWER:
          this.renderTowerPanel(c, entity);
          break;
        case EntityType.JUNGLE_CAMP:
          this.renderJunglePanel(c, entity);
          break;
        default:
          this.renderGenericPanel(c, entity);
          break;
      }
    });
  }

  /**
   * Render the full champion information panel.
   */
  private renderChampionPanel(c: CanvasRenderingContext2D, entity: InterpolatedEntity): void {
    const snapshot = entity.snapshot as ChampionSnapshot;
    const isAlly = snapshot.side === this.localSide;
    const accentColor = isAlly ? COLORS.championAlly : COLORS.championEnemy;

    const x = PANEL.margin;
    const y = PANEL.margin;
    const width = PANEL.championWidth;
    const height = PANEL.championHeight;

    // Draw background panel
    this.drawPanelBackground(c, x, y, width, height, accentColor);

    // Get champion definition for name
    const champDef = getChampionDefinition(snapshot.championId);
    const champName = champDef?.name || snapshot.championId;

    // === TOP ROW: Portrait + Name/Level + Health/Mana ===
    const portraitX = x + PANEL.padding;
    const portraitY = y + PANEL.padding;

    // Portrait placeholder (colored square)
    c.fillStyle = accentColor;
    c.fillRect(portraitX, portraitY, PANEL.portraitSize, PANEL.portraitSize);
    c.strokeStyle = COLORS.borderHighlight;
    c.lineWidth = 2;
    c.strokeRect(portraitX, portraitY, PANEL.portraitSize, PANEL.portraitSize);

    // Level badge
    const levelBadgeSize = 26;
    c.fillStyle = '#1a1a2e';
    c.fillRect(
      portraitX + PANEL.portraitSize - levelBadgeSize + 4,
      portraitY + PANEL.portraitSize - levelBadgeSize + 4,
      levelBadgeSize,
      levelBadgeSize
    );
    c.strokeStyle = accentColor;
    c.lineWidth = 2;
    c.strokeRect(
      portraitX + PANEL.portraitSize - levelBadgeSize + 4,
      portraitY + PANEL.portraitSize - levelBadgeSize + 4,
      levelBadgeSize,
      levelBadgeSize
    );
    RenderUtils.renderBitmapText(c, `${snapshot.level}`,
      portraitX + PANEL.portraitSize - levelBadgeSize / 2 + 4,
      portraitY + PANEL.portraitSize - levelBadgeSize / 2,
      { size: FONT.medium, color: '#ffffff', centered: true }
    );

    // Champion name (large)
    const infoX = portraitX + PANEL.portraitSize + 12;
    const nameY = portraitY + 2;
    RenderUtils.renderBitmapText(c, champName, infoX, nameY, {
      size: FONT.title,
      color: COLORS.text
    });

    // K/D/A next to name
    const kdaText = `${snapshot.kills} / ${snapshot.deaths} / ${snapshot.assists}`;
    RenderUtils.renderBitmapText(c, kdaText, infoX + 160, nameY + 2, {
      size: FONT.medium,
      color: COLORS.textDim
    });

    // Health bar
    const barX = infoX;
    const barY = nameY + 30;
    const barWidth = width - PANEL.padding * 2 - PANEL.portraitSize - 16;
    this.drawHealthBar(c, barX, barY, barWidth, PANEL.healthBarHeight,
      snapshot.health, snapshot.maxHealth, isAlly);

    // Mana bar
    const manaY = barY + PANEL.healthBarHeight + 4;
    this.drawResourceBar(c, barX, manaY, barWidth, PANEL.healthBarHeight - 4,
      snapshot.resource, snapshot.maxResource);

    // Dead indicator or respawn timer
    if (snapshot.isDead) {
      const deadY = manaY + PANEL.healthBarHeight + 4;
      const respawnText = snapshot.respawnTimer > 0
        ? `DEAD - Respawn: ${Math.ceil(snapshot.respawnTimer)}s`
        : 'DEAD';
      RenderUtils.renderBitmapText(c, respawnText, barX, deadY, {
        size: FONT.normal,
        color: '#ff4444'
      });
    }

    // === MIDDLE ROW: Stats (2 columns) ===
    const statsY = portraitY + PANEL.portraitSize + 12;
    const col1X = x + PANEL.padding;
    const col2X = x + PANEL.padding + 110;
    const col3X = x + PANEL.padding + 220;

    // Row 1
    this.drawStatLine(c, col1X, statsY, 'AD', Math.round(snapshot.attackDamage), '#ff9966');
    this.drawStatLine(c, col2X, statsY, 'AP', Math.round(snapshot.abilityPower), '#9966ff');
    this.drawStatLine(c, col3X, statsY, 'ARM', Math.round(snapshot.armor), '#ffcc00');

    // Row 2
    const statsY2 = statsY + PANEL.statLineHeight;
    this.drawStatLine(c, col1X, statsY2, 'MR', Math.round(snapshot.magicResist), '#66ccff');
    this.drawStatLine(c, col2X, statsY2, 'AS', snapshot.attackSpeed.toFixed(2), '#66ff66');
    this.drawStatLine(c, col3X, statsY2, 'MS', Math.round(snapshot.movementSpeed), '#ffffff');

    // Row 3: CS and Gold
    const statsY3 = statsY2 + PANEL.statLineHeight;
    this.drawStatLine(c, col1X, statsY3, 'CS', snapshot.cs, '#cccccc');
    if (isAlly) {
      this.drawStatLine(c, col2X, statsY3, 'Gold', Math.floor(snapshot.gold), COLORS.gold);
    }

    // === ABILITIES ROW ===
    const abilityY = statsY3 + PANEL.statLineHeight + 8;
    const abilityStartX = x + PANEL.padding;
    const slots: ('Q' | 'W' | 'E' | 'R')[] = ['Q', 'W', 'E', 'R'];

    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i];
      const ability = snapshot.abilities[slot];
      const iconX = abilityStartX + i * (PANEL.abilityIconSize + PANEL.abilityIconGap);

      // Ability box
      const isReady = ability.cooldownRemaining === 0 && ability.rank > 0;
      c.fillStyle = isReady ? '#333355' : '#222233';
      c.fillRect(iconX, abilityY, PANEL.abilityIconSize, PANEL.abilityIconSize);
      c.strokeStyle = ability.rank > 0 ? accentColor : '#444466';
      c.lineWidth = 2;
      c.strokeRect(iconX, abilityY, PANEL.abilityIconSize, PANEL.abilityIconSize);

      // Ability letter
      RenderUtils.renderBitmapText(c, slot,
        iconX + PANEL.abilityIconSize / 2,
        abilityY + PANEL.abilityIconSize / 2 - 8,
        { size: FONT.large, color: ability.rank > 0 ? COLORS.text : COLORS.textDim, centered: true }
      );

      // Rank indicator
      if (ability.rank > 0) {
        RenderUtils.renderBitmapText(c, `${ability.rank}`,
          iconX + PANEL.abilityIconSize - 6,
          abilityY + PANEL.abilityIconSize - 16,
          { size: FONT.small, color: accentColor, rightAlign: true }
        );
      }

      // Cooldown overlay (only show for allies)
      if (isAlly && ability.cooldownRemaining > 0 && ability.rank > 0) {
        c.fillStyle = 'rgba(0, 0, 0, 0.75)';
        c.fillRect(iconX, abilityY, PANEL.abilityIconSize, PANEL.abilityIconSize);
        RenderUtils.renderBitmapText(c, Math.ceil(ability.cooldownRemaining).toString(),
          iconX + PANEL.abilityIconSize / 2,
          abilityY + PANEL.abilityIconSize / 2 - 8,
          { size: FONT.large, color: '#ffffff', centered: true }
        );
      }
    }

    // === ITEMS ROW (to the right of abilities) ===
    const itemsX = abilityStartX + (PANEL.abilityIconSize + PANEL.abilityIconGap) * 4 + 16;
    const itemsY = abilityY;

    for (let i = 0; i < 6; i++) {
      const row = Math.floor(i / 3);
      const col = i % 3;
      const itemX = itemsX + col * (PANEL.itemSize + PANEL.itemGap);
      const itemY = itemsY + row * (PANEL.itemSize + PANEL.itemGap);
      const item = snapshot.items?.[i];

      // Item slot background
      c.fillStyle = item ? '#333355' : '#1a1a2e';
      c.fillRect(itemX, itemY, PANEL.itemSize, PANEL.itemSize);
      c.strokeStyle = COLORS.border;
      c.lineWidth = 1;
      c.strokeRect(itemX, itemY, PANEL.itemSize, PANEL.itemSize);

      if (item) {
        // Item indicator
        c.fillStyle = this.getItemColor(item.definitionId);
        c.fillRect(itemX + 3, itemY + 3, PANEL.itemSize - 6, PANEL.itemSize - 6);
      }
    }

    // === ACTIVE EFFECTS (bottom) ===
    if (snapshot.activeEffects && snapshot.activeEffects.length > 0) {
      const effectY = y + height - PANEL.padding - 24;
      const effectSize = 22;
      const effectGap = 4;
      let effectX = x + PANEL.padding;

      for (let i = 0; i < Math.min(snapshot.activeEffects.length, 10); i++) {
        const effect = snapshot.activeEffects[i];

        c.fillStyle = this.getEffectColor(effect.definitionId);
        c.fillRect(effectX, effectY, effectSize, effectSize);
        c.strokeStyle = COLORS.border;
        c.lineWidth = 1;
        c.strokeRect(effectX, effectY, effectSize, effectSize);

        if (effect.stacks > 1) {
          RenderUtils.renderBitmapText(c, effect.stacks.toString(),
            effectX + effectSize - 2, effectY + effectSize - 14,
            { size: FONT.small, color: '#ffffff', rightAlign: true }
          );
        }

        effectX += effectSize + effectGap;
      }
    }

    // === SHIELDS (if any) ===
    if (snapshot.shields && snapshot.shields.length > 0) {
      const totalShield = snapshot.shields.reduce((sum, s) => sum + s.amount, 0);
      const shieldY = manaY + PANEL.healthBarHeight + 4;
      if (!snapshot.isDead) {
        RenderUtils.renderBitmapText(c, `Shield: ${Math.ceil(totalShield)}`,
          barX, shieldY, { size: FONT.normal, color: '#66aaff' });
      }
    }
  }

  /**
   * Render a simple minion panel.
   */
  private renderMinionPanel(c: CanvasRenderingContext2D, entity: InterpolatedEntity): void {
    const snapshot = entity.snapshot as MinionSnapshot;
    const isAlly = snapshot.side === this.localSide;

    const x = PANEL.margin;
    const y = PANEL.margin;
    const width = PANEL.simpleWidth;
    const height = PANEL.simpleHeight;

    this.drawPanelBackground(c, x, y, width, height, COLORS.minion);

    const typeLabel = this.getMinionTypeLabel(snapshot.minionType);
    RenderUtils.renderBitmapText(c, typeLabel, x + PANEL.padding, y + PANEL.padding, {
      size: FONT.large,
      color: COLORS.text,
    });

    const barY = y + PANEL.padding + 32;
    this.drawHealthBar(c, x + PANEL.padding, barY, width - PANEL.padding * 2,
      PANEL.healthBarHeight, snapshot.health, snapshot.maxHealth, isAlly);
  }

  /**
   * Render a simple tower panel.
   */
  private renderTowerPanel(c: CanvasRenderingContext2D, entity: InterpolatedEntity): void {
    const snapshot = entity.snapshot as TowerSnapshot;
    const isAlly = snapshot.side === this.localSide;

    const x = PANEL.margin;
    const y = PANEL.margin;
    const width = PANEL.simpleWidth;
    const height = PANEL.simpleHeight;

    this.drawPanelBackground(c, x, y, width, height, COLORS.tower);

    const tierLabel = snapshot.tier === 1 ? 'Outer' : snapshot.tier === 2 ? 'Inner' : 'Inhib';
    const laneLabel = snapshot.lane.charAt(0).toUpperCase() + snapshot.lane.slice(1);
    const label = `${tierLabel} ${laneLabel} Tower`;
    RenderUtils.renderBitmapText(c, label, x + PANEL.padding, y + PANEL.padding, {
      size: FONT.large,
      color: COLORS.text,
    });

    const barY = y + PANEL.padding + 32;
    this.drawHealthBar(c, x + PANEL.padding, barY, width - PANEL.padding * 2,
      PANEL.healthBarHeight, snapshot.health, snapshot.maxHealth, isAlly);
  }

  /**
   * Render a simple jungle creature panel.
   */
  private renderJunglePanel(c: CanvasRenderingContext2D, entity: InterpolatedEntity): void {
    const snapshot = entity.snapshot as JungleCreatureSnapshot;

    const x = PANEL.margin;
    const y = PANEL.margin;
    const width = PANEL.simpleWidth;
    const height = PANEL.simpleHeight;

    this.drawPanelBackground(c, x, y, width, height, COLORS.jungle);

    const name = this.getJungleCreatureName(snapshot.creatureType);
    RenderUtils.renderBitmapText(c, name, x + PANEL.padding, y + PANEL.padding, {
      size: FONT.large,
      color: COLORS.text,
    });

    const barY = y + PANEL.padding + 32;
    this.drawHealthBar(c, x + PANEL.padding, barY, width - PANEL.padding * 2,
      PANEL.healthBarHeight, snapshot.health, snapshot.maxHealth, false);
  }

  /**
   * Render a generic panel for other entity types.
   */
  private renderGenericPanel(c: CanvasRenderingContext2D, entity: InterpolatedEntity): void {
    const x = PANEL.margin;
    const y = PANEL.margin;
    const width = PANEL.simpleWidth;
    const height = PANEL.simpleHeight;

    this.drawPanelBackground(c, x, y, width, height, COLORS.border);

    const typeName = EntityType[entity.snapshot.entityType] || 'Unknown';
    RenderUtils.renderBitmapText(c, typeName, x + PANEL.padding, y + PANEL.padding, {
      size: FONT.large,
      color: COLORS.text,
    });

    const snapshot = entity.snapshot as any;
    if (typeof snapshot.health === 'number' && typeof snapshot.maxHealth === 'number') {
      const isAlly = 'side' in snapshot && snapshot.side === this.localSide;
      const barY = y + PANEL.padding + 32;
      this.drawHealthBar(c, x + PANEL.padding, barY, width - PANEL.padding * 2,
        PANEL.healthBarHeight, snapshot.health, snapshot.maxHealth, isAlly);
    }
  }

  // ============================================================================
  // Helper drawing methods
  // ============================================================================

  private drawPanelBackground(
    c: CanvasRenderingContext2D,
    x: number, y: number, width: number, height: number,
    accentColor: string
  ): void {
    c.fillStyle = COLORS.background;
    c.beginPath();
    c.roundRect(x, y, width, height, PANEL.borderRadius);
    c.fill();

    c.strokeStyle = COLORS.border;
    c.lineWidth = 2;
    c.stroke();

    c.fillStyle = accentColor;
    c.fillRect(x + 2, y + 2, width - 4, 4);
  }

  private drawHealthBar(
    c: CanvasRenderingContext2D,
    x: number, y: number, width: number, height: number,
    current: number, max: number, isAlly: boolean
  ): void {
    const pct = Math.max(0, Math.min(1, current / max));

    c.fillStyle = isAlly ? COLORS.healthBarBg : COLORS.healthBarEnemyBg;
    c.fillRect(x, y, width, height);

    c.fillStyle = isAlly ? COLORS.healthBar : COLORS.healthBarEnemy;
    c.fillRect(x, y, width * pct, height);

    c.strokeStyle = COLORS.border;
    c.lineWidth = 1;
    c.strokeRect(x, y, width, height);

    const text = `${Math.ceil(current)} / ${Math.ceil(max)}`;
    RenderUtils.renderBitmapText(c, text, x + width / 2, y + height / 2 - 6, {
      size: FONT.normal,
      color: COLORS.text,
      centered: true,
    });
  }

  private drawResourceBar(
    c: CanvasRenderingContext2D,
    x: number, y: number, width: number, height: number,
    current: number, max: number
  ): void {
    const pct = Math.max(0, Math.min(1, current / max));

    c.fillStyle = COLORS.manaBarBg;
    c.fillRect(x, y, width, height);

    c.fillStyle = COLORS.manaBar;
    c.fillRect(x, y, width * pct, height);

    c.strokeStyle = COLORS.border;
    c.lineWidth = 1;
    c.strokeRect(x, y, width, height);

    const text = `${Math.ceil(current)} / ${Math.ceil(max)}`;
    RenderUtils.renderBitmapText(c, text, x + width / 2, y + height / 2 - 5, {
      size: FONT.small,
      color: COLORS.text,
      centered: true,
    });
  }

  private drawStatLine(
    c: CanvasRenderingContext2D,
    x: number, y: number,
    label: string, value: number | string, color: string
  ): void {
    RenderUtils.renderBitmapText(c, `${label}:`, x, y, {
      size: FONT.normal,
      color: COLORS.textDim,
    });
    RenderUtils.renderBitmapText(c, `${value}`, x + 40, y, {
      size: FONT.normal,
      color: color,
    });
  }

  private getMinionTypeLabel(type: string): string {
    switch (type) {
      case 'melee': return 'Melee Minion';
      case 'caster': return 'Caster Minion';
      case 'siege': return 'Siege Minion';
      case 'super': return 'Super Minion';
      default: return 'Minion';
    }
  }

  private getJungleCreatureName(type: string): string {
    return type
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  private getEffectColor(definitionId: string): string {
    if (definitionId.includes('stun') || definitionId.includes('root')) {
      return '#ff4444';
    }
    if (definitionId.includes('slow')) {
      return '#4488ff';
    }
    if (definitionId.includes('shield') || definitionId.includes('heal')) {
      return '#44ff44';
    }
    if (definitionId.includes('damage') || definitionId.includes('burn')) {
      return '#ff8800';
    }
    if (definitionId.includes('speed') || definitionId.includes('buff')) {
      return '#ffff44';
    }
    return '#888888';
  }

  private getItemColor(itemId: string): string {
    let hash = 0;
    for (let i = 0; i < itemId.length; i++) {
      hash = itemId.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 50%, 45%)`;
  }
}

export default TargetInfoHUD;
