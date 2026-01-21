/**
 * DebugPanel - Renders a debug panel showing entity properties.
 *
 * Displays all properties of the inspected entity in a formatted panel
 * in the corner of the screen.
 */

import type { InspectedEntity, DebugInspectorConfig, DebugPanelSection, DebugProperty } from './types';
import { getEntityTypeName } from './types';

/**
 * Color theme for the debug panel.
 */
const COLORS = {
  background: 'rgba(20, 20, 30, 0.95)',
  border: 'rgba(100, 100, 120, 0.8)',
  headerBg: 'rgba(40, 40, 60, 1)',
  sectionHeaderBg: 'rgba(50, 50, 70, 0.8)',
  text: '#e0e0e0',
  textDim: '#a0a0a0',
  textBright: '#ffffff',
  key: '#88c0d0',
  valueString: '#a3be8c',
  valueNumber: '#b48ead',
  valueBoolean: '#ebcb8b',
  valueNull: '#bf616a',
  highlight: 'rgba(100, 150, 200, 0.3)',
  closeButton: '#bf616a',
  closeButtonHover: '#d08770',
};

/**
 * DebugPanel renders entity properties.
 */
export class DebugPanel {
  private config: DebugInspectorConfig;
  private inspectedEntity: InspectedEntity | null = null;
  private scrollOffset = 0;
  private maxScrollOffset = 0;
  private sections: DebugPanelSection[] = [];
  private isCloseButtonHovered = false;

  // Panel geometry (computed)
  private panelX = 10;
  private panelY = 10;
  private panelHeight = 0;
  private closeButtonRect = { x: 0, y: 0, width: 20, height: 20 };

  constructor(config: DebugInspectorConfig) {
    this.config = config;
  }

  /**
   * Set the entity to inspect.
   */
  setInspectedEntity(entity: InspectedEntity | null): void {
    this.inspectedEntity = entity;
    this.scrollOffset = 0;

    if (entity) {
      this.sections = this.buildSections(entity);
    } else {
      this.sections = [];
    }
  }

  /**
   * Get the currently inspected entity.
   */
  getInspectedEntity(): InspectedEntity | null {
    return this.inspectedEntity;
  }

  /**
   * Clear the inspected entity.
   */
  clearInspection(): void {
    this.setInspectedEntity(null);
  }

  /**
   * Handle scroll input.
   */
  handleScroll(deltaY: number): void {
    if (!this.inspectedEntity) return;

    this.scrollOffset = Math.max(
      0,
      Math.min(this.maxScrollOffset, this.scrollOffset + deltaY * 0.5)
    );
  }

  /**
   * Check if a screen position is within the panel.
   */
  isPointInPanel(x: number, y: number): boolean {
    if (!this.inspectedEntity) return false;

    return (
      x >= this.panelX &&
      x <= this.panelX + this.config.panelWidth &&
      y >= this.panelY &&
      y <= this.panelY + this.panelHeight
    );
  }

  /**
   * Check if point is on close button.
   */
  isPointOnCloseButton(x: number, y: number): boolean {
    if (!this.inspectedEntity) return false;

    const btn = this.closeButtonRect;
    return x >= btn.x && x <= btn.x + btn.width && y >= btn.y && y <= btn.y + btn.height;
  }

  /**
   * Update close button hover state.
   */
  updateHoverState(x: number, y: number): void {
    this.isCloseButtonHovered = this.isPointOnCloseButton(x, y);
  }

  /**
   * Render the debug panel.
   */
  render(ctx: CanvasRenderingContext2D): void {
    if (!this.inspectedEntity) return;

    const { panelWidth, fontSize, opacity, position } = this.config;

    // Compute panel position
    this.computePanelPosition(ctx.canvas.width, ctx.canvas.height);

    ctx.save();

    // Set up font
    ctx.font = `${fontSize}px 'Courier New', monospace`;
    ctx.textBaseline = 'top';

    // Calculate content height
    const contentHeight = this.calculateContentHeight(ctx);
    this.panelHeight = Math.min(this.config.maxPanelHeight, contentHeight + 40);
    this.maxScrollOffset = Math.max(0, contentHeight - this.panelHeight + 50);

    // Draw panel background
    ctx.globalAlpha = opacity;
    ctx.fillStyle = COLORS.background;
    this.roundRect(ctx, this.panelX, this.panelY, panelWidth, this.panelHeight, 8);
    ctx.fill();

    // Draw border
    ctx.strokeStyle = COLORS.border;
    ctx.lineWidth = 2;
    this.roundRect(ctx, this.panelX, this.panelY, panelWidth, this.panelHeight, 8);
    ctx.stroke();

    // Draw header
    this.drawHeader(ctx);

    // Create clipping region for content
    ctx.save();
    ctx.beginPath();
    ctx.rect(this.panelX, this.panelY + 35, panelWidth, this.panelHeight - 40);
    ctx.clip();

    // Draw sections
    let yOffset = this.panelY + 40 - this.scrollOffset;
    for (const section of this.sections) {
      yOffset = this.drawSection(ctx, section, yOffset);
    }

    ctx.restore();

    // Draw scroll indicator if needed
    if (this.maxScrollOffset > 0) {
      this.drawScrollIndicator(ctx);
    }

    ctx.restore();
  }

  /**
   * Compute panel position based on config.
   */
  private computePanelPosition(canvasWidth: number, canvasHeight: number): void {
    const margin = 10;

    switch (this.config.position) {
      case 'top-left':
        this.panelX = margin;
        this.panelY = margin;
        break;
      case 'top-right':
        this.panelX = canvasWidth - this.config.panelWidth - margin;
        this.panelY = margin;
        break;
      case 'bottom-left':
        this.panelX = margin;
        this.panelY = canvasHeight - this.panelHeight - margin;
        break;
      case 'bottom-right':
        this.panelX = canvasWidth - this.config.panelWidth - margin;
        this.panelY = canvasHeight - this.panelHeight - margin;
        break;
    }
  }

  /**
   * Draw the panel header.
   */
  private drawHeader(ctx: CanvasRenderingContext2D): void {
    if (!this.inspectedEntity) return;

    const headerHeight = 30;

    // Header background
    ctx.fillStyle = COLORS.headerBg;
    this.roundRectTop(ctx, this.panelX, this.panelY, this.config.panelWidth, headerHeight, 8);
    ctx.fill();

    // Entity type and ID
    ctx.fillStyle = COLORS.textBright;
    ctx.font = `bold ${this.config.fontSize + 2}px 'Courier New', monospace`;

    const title = `${this.inspectedEntity.entityTypeName}`;
    ctx.fillText(title, this.panelX + 10, this.panelY + 8);

    // Entity ID (dimmer)
    ctx.fillStyle = COLORS.textDim;
    ctx.font = `${this.config.fontSize - 1}px 'Courier New', monospace`;
    const idText = `#${this.inspectedEntity.entityId.substring(0, 12)}`;
    const titleWidth = ctx.measureText(title).width;
    ctx.fillText(idText, this.panelX + 10 + titleWidth + 10, this.panelY + 10);

    // Close button
    const btnSize = 18;
    const btnX = this.panelX + this.config.panelWidth - btnSize - 8;
    const btnY = this.panelY + 6;
    this.closeButtonRect = { x: btnX, y: btnY, width: btnSize, height: btnSize };

    ctx.fillStyle = this.isCloseButtonHovered ? COLORS.closeButtonHover : COLORS.closeButton;
    ctx.beginPath();
    ctx.arc(btnX + btnSize / 2, btnY + btnSize / 2, btnSize / 2, 0, Math.PI * 2);
    ctx.fill();

    // X symbol
    ctx.strokeStyle = COLORS.textBright;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(btnX + 5, btnY + 5);
    ctx.lineTo(btnX + btnSize - 5, btnY + btnSize - 5);
    ctx.moveTo(btnX + btnSize - 5, btnY + 5);
    ctx.lineTo(btnX + 5, btnY + btnSize - 5);
    ctx.stroke();
  }

  /**
   * Draw a section with its properties.
   */
  private drawSection(ctx: CanvasRenderingContext2D, section: DebugPanelSection, yOffset: number): number {
    const lineHeight = this.config.fontSize + 6;
    const indent = 15;
    let y = yOffset;

    // Section header
    ctx.fillStyle = COLORS.sectionHeaderBg;
    ctx.fillRect(this.panelX + 5, y, this.config.panelWidth - 10, lineHeight);

    ctx.fillStyle = COLORS.textBright;
    ctx.font = `bold ${this.config.fontSize}px 'Courier New', monospace`;
    ctx.fillText(section.title, this.panelX + 10, y + 3);

    y += lineHeight + 4;

    // Properties
    ctx.font = `${this.config.fontSize}px 'Courier New', monospace`;
    for (const prop of section.properties) {
      y = this.drawProperty(ctx, prop, y, indent);
    }

    return y + 8;
  }

  /**
   * Draw a single property.
   */
  private drawProperty(ctx: CanvasRenderingContext2D, prop: DebugProperty, y: number, indent: number): number {
    const lineHeight = this.config.fontSize + 4;
    const keyWidth = 120;

    // Property name
    ctx.fillStyle = COLORS.key;
    ctx.fillText(prop.name, this.panelX + indent, y);

    // Property value
    const valueX = this.panelX + indent + keyWidth;
    const maxValueWidth = this.config.panelWidth - indent - keyWidth - 20;

    ctx.fillStyle = this.getValueColor(prop.rawValue);

    // Truncate value if too long
    let displayValue = prop.value;
    const valueWidth = ctx.measureText(displayValue).width;
    if (valueWidth > maxValueWidth) {
      while (ctx.measureText(displayValue + '...').width > maxValueWidth && displayValue.length > 0) {
        displayValue = displayValue.slice(0, -1);
      }
      displayValue += '...';
    }

    ctx.fillText(displayValue, valueX, y);

    return y + lineHeight;
  }

  /**
   * Get color for a value based on its type.
   */
  private getValueColor(value: unknown): string {
    if (value === null || value === undefined) return COLORS.valueNull;
    if (typeof value === 'string') return COLORS.valueString;
    if (typeof value === 'number') return COLORS.valueNumber;
    if (typeof value === 'boolean') return COLORS.valueBoolean;
    return COLORS.text;
  }

  /**
   * Draw scroll indicator.
   */
  private drawScrollIndicator(ctx: CanvasRenderingContext2D): void {
    const trackX = this.panelX + this.config.panelWidth - 8;
    const trackY = this.panelY + 35;
    const trackHeight = this.panelHeight - 40;
    const thumbHeight = Math.max(20, (this.panelHeight / (this.maxScrollOffset + this.panelHeight)) * trackHeight);
    const thumbY = trackY + (this.scrollOffset / this.maxScrollOffset) * (trackHeight - thumbHeight);

    // Track
    ctx.fillStyle = 'rgba(60, 60, 80, 0.5)';
    ctx.fillRect(trackX, trackY, 4, trackHeight);

    // Thumb
    ctx.fillStyle = 'rgba(120, 120, 150, 0.8)';
    ctx.fillRect(trackX, thumbY, 4, thumbHeight);
  }

  /**
   * Calculate total content height.
   */
  private calculateContentHeight(ctx: CanvasRenderingContext2D): number {
    const lineHeight = this.config.fontSize + 6;
    let height = 0;

    for (const section of this.sections) {
      height += lineHeight + 4; // Section header
      height += section.properties.length * (this.config.fontSize + 4);
      height += 8; // Section spacing
    }

    return height;
  }

  /**
   * Build sections from entity data.
   */
  private buildSections(entity: InspectedEntity): DebugPanelSection[] {
    const sections: DebugPanelSection[] = [];
    const snapshot = entity.snapshot as any;

    // Basic info section
    sections.push({
      title: 'Basic Info',
      collapsed: false,
      properties: [
        { name: 'Entity ID', value: entity.entityId, rawValue: entity.entityId },
        { name: 'Type', value: entity.entityTypeName, rawValue: entity.entityType },
        { name: 'Side', value: String(snapshot.side ?? 'N/A'), rawValue: snapshot.side },
      ],
    });

    // Position section
    sections.push({
      title: 'Position',
      collapsed: false,
      properties: [
        { name: 'X', value: entity.position.x.toFixed(1), rawValue: entity.position.x },
        { name: 'Y', value: entity.position.y.toFixed(1), rawValue: entity.position.y },
        { name: 'Target X', value: snapshot.targetX?.toFixed(1) ?? 'N/A', rawValue: snapshot.targetX },
        { name: 'Target Y', value: snapshot.targetY?.toFixed(1) ?? 'N/A', rawValue: snapshot.targetY },
        { name: 'Target Entity', value: snapshot.targetEntityId ?? 'N/A', rawValue: snapshot.targetEntityId },
      ],
    });

    // Health section
    if ('health' in snapshot) {
      sections.push({
        title: 'Health',
        collapsed: false,
        properties: [
          { name: 'Health', value: `${Math.round(snapshot.health)} / ${snapshot.maxHealth}`, rawValue: snapshot.health },
          { name: 'Is Dead', value: String(snapshot.isDead ?? false), rawValue: snapshot.isDead },
        ],
      });
    }

    // Champion-specific section
    if (snapshot.entityType === 0) { // CHAMPION
      sections.push({
        title: 'Champion Stats',
        collapsed: false,
        properties: [
          { name: 'Champion ID', value: snapshot.championId ?? 'N/A', rawValue: snapshot.championId },
          { name: 'Player ID', value: snapshot.playerId ?? 'N/A', rawValue: snapshot.playerId },
          { name: 'Level', value: String(snapshot.level ?? 1), rawValue: snapshot.level },
          { name: 'Experience', value: String(snapshot.experience ?? 0), rawValue: snapshot.experience },
          { name: 'Gold', value: String(snapshot.gold ?? 0), rawValue: snapshot.gold },
          { name: 'Resource', value: `${Math.round(snapshot.resource ?? 0)} / ${snapshot.maxResource ?? 0}`, rawValue: snapshot.resource },
        ],
      });

      sections.push({
        title: 'Combat Stats',
        collapsed: false,
        properties: [
          { name: 'Attack Damage', value: String(snapshot.attackDamage ?? 0), rawValue: snapshot.attackDamage },
          { name: 'Ability Power', value: String(snapshot.abilityPower ?? 0), rawValue: snapshot.abilityPower },
          { name: 'Armor', value: String(snapshot.armor ?? 0), rawValue: snapshot.armor },
          { name: 'Magic Resist', value: String(snapshot.magicResist ?? 0), rawValue: snapshot.magicResist },
          { name: 'Attack Speed', value: snapshot.attackSpeed?.toFixed(2) ?? 'N/A', rawValue: snapshot.attackSpeed },
          { name: 'Move Speed', value: String(snapshot.movementSpeed ?? 0), rawValue: snapshot.movementSpeed },
        ],
      });

      sections.push({
        title: 'Score',
        collapsed: false,
        properties: [
          { name: 'K/D/A', value: `${snapshot.kills ?? 0}/${snapshot.deaths ?? 0}/${snapshot.assists ?? 0}`, rawValue: null },
          { name: 'CS', value: String(snapshot.cs ?? 0), rawValue: snapshot.cs },
        ],
      });

      sections.push({
        title: 'State',
        collapsed: false,
        properties: [
          { name: 'Is Recalling', value: String(snapshot.isRecalling ?? false), rawValue: snapshot.isRecalling },
          { name: 'Recall Progress', value: snapshot.recallProgress?.toFixed(2) ?? 'N/A', rawValue: snapshot.recallProgress },
          { name: 'Respawn Timer', value: snapshot.respawnTimer?.toFixed(1) ?? 'N/A', rawValue: snapshot.respawnTimer },
        ],
      });
    }

    // Minion-specific section
    if (snapshot.entityType === 1) { // MINION
      sections.push({
        title: 'Minion Info',
        collapsed: false,
        properties: [
          { name: 'Minion Type', value: snapshot.minionType ?? 'N/A', rawValue: snapshot.minionType },
          { name: 'Is Attacking', value: String(snapshot.isAttacking ?? false), rawValue: snapshot.isAttacking },
        ],
      });
    }

    // Tower-specific section
    if (snapshot.entityType === 2) { // TOWER
      sections.push({
        title: 'Tower Info',
        collapsed: false,
        properties: [
          { name: 'Lane', value: snapshot.lane ?? 'N/A', rawValue: snapshot.lane },
          { name: 'Tier', value: String(snapshot.tier ?? 'N/A'), rawValue: snapshot.tier },
          { name: 'Is Destroyed', value: String(snapshot.isDestroyed ?? false), rawValue: snapshot.isDestroyed },
        ],
      });
    }

    // Ward-specific section
    if (snapshot.entityType === 7) { // WARD
      sections.push({
        title: 'Ward Info',
        collapsed: false,
        properties: [
          { name: 'Ward Type', value: snapshot.wardType ?? 'N/A', rawValue: snapshot.wardType },
          { name: 'Owner ID', value: snapshot.ownerId ?? 'N/A', rawValue: snapshot.ownerId },
          { name: 'Sight Range', value: String(snapshot.sightRange ?? 0), rawValue: snapshot.sightRange },
          { name: 'Is Stealthed', value: String(snapshot.isStealthed ?? false), rawValue: snapshot.isStealthed },
          { name: 'Duration Left', value: snapshot.remainingDuration?.toFixed(1) ?? 'N/A', rawValue: snapshot.remainingDuration },
        ],
      });
    }

    // Jungle creature section
    if (snapshot.entityType === 5) { // JUNGLE_CAMP
      sections.push({
        title: 'Jungle Creature',
        collapsed: false,
        properties: [
          { name: 'Camp ID', value: snapshot.campId ?? 'N/A', rawValue: snapshot.campId },
          { name: 'Creature Type', value: snapshot.creatureType ?? 'N/A', rawValue: snapshot.creatureType },
        ],
      });
    }

    // Raw snapshot section (all remaining properties)
    const handledKeys = new Set([
      'entityId', 'entityType', 'side', 'x', 'y', 'targetX', 'targetY', 'targetEntityId',
      'health', 'maxHealth', 'isDead', 'isDestroyed',
      'championId', 'playerId', 'level', 'experience', 'gold', 'resource', 'maxResource',
      'attackDamage', 'abilityPower', 'armor', 'magicResist', 'attackSpeed', 'movementSpeed',
      'kills', 'deaths', 'assists', 'cs',
      'isRecalling', 'recallProgress', 'respawnTimer',
      'minionType', 'isAttacking',
      'lane', 'tier',
      'wardType', 'ownerId', 'sightRange', 'isStealthed', 'remainingDuration', 'placedAt',
      'campId', 'creatureType',
    ]);

    const otherProps: DebugProperty[] = [];
    for (const [key, value] of Object.entries(snapshot)) {
      if (handledKeys.has(key)) continue;
      if (value === undefined) continue;

      let displayValue = String(value);
      if (typeof value === 'object' && value !== null) {
        displayValue = JSON.stringify(value).substring(0, 50);
      }

      otherProps.push({
        name: key,
        value: displayValue,
        rawValue: value,
      });
    }

    if (otherProps.length > 0) {
      sections.push({
        title: 'Other Properties',
        collapsed: false,
        properties: otherProps,
      });
    }

    return sections;
  }

  /**
   * Draw a rounded rectangle.
   */
  private roundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number
  ): void {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  /**
   * Draw a rounded rectangle with only top corners rounded.
   */
  private roundRectTop(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number
  ): void {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height);
    ctx.lineTo(x, y + height);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }
}

export default DebugPanel;
