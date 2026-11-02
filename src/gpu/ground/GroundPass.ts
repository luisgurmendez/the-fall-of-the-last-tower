/**
 * Draws the ground: the terrain field (./terrainField.ts) as a texture and
 * one full-screen triangle running the ground shader (./groundShader.ts).
 */

import { MOBAConfig } from "@siege/shared";
import { createDataTexture, createProgram, FULLSCREEN_VERTEX, type Program } from "../gl";
import type { GPUView } from "../view";
import { buildTerrainField, type TerrainField } from "./terrainField";
import { GROUND_FRAGMENT, GROUND_UNIFORMS } from "./groundShader";

export class GroundPass {
  private readonly program: Program;
  private readonly fieldTexture: WebGLTexture;
  private readonly floorTexture: WebGLTexture;
  private readonly field: TerrainField;
  private readonly riverDirection: [number, number];

  constructor(private readonly gl: WebGL2RenderingContext) {
    this.program = createProgram(gl, FULLSCREEN_VERTEX, GROUND_FRAGMENT, GROUND_UNIFORMS);
    this.field = buildTerrainField();
    this.fieldTexture = createDataTexture(gl, this.field.width, this.field.height, this.field.data);
    this.floorTexture = createDataTexture(gl, this.field.width, this.field.height, this.field.floor);
    const [from, to] = [MOBAConfig.RIVER.points[0], MOBAConfig.RIVER.points[MOBAConfig.RIVER.points.length - 1]];
    const length = Math.hypot(to.x - from.x, to.y - from.y) || 1;
    this.riverDirection = [(to.x - from.x) / length, (to.y - from.y) / length];
  }

  draw(view: GPUView): void {
    const { gl, program, field } = this;
    const u = program.uniforms;
    gl.useProgram(program.program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.fieldTexture);
    gl.uniform1i(u.uField, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.floorTexture);
    gl.uniform1i(u.uFloor, 1);
    gl.activeTexture(gl.TEXTURE0);
    gl.uniform2f(u.uFieldOrigin, field.originX, field.originY);
    gl.uniform2f(u.uFieldSize, field.width * field.cell, field.height * field.cell);
    gl.uniform2f(u.uViewOrigin, view.originX, view.originY);
    gl.uniform1f(u.uWorldPerPixel, view.worldPerPixel);
    gl.uniform1f(u.uCanvasHeight, view.height);
    gl.uniform1f(u.uTime, view.time);
    gl.uniform2f(u.uNexusBlue, MOBAConfig.NEXUS.BLUE.x, MOBAConfig.NEXUS.BLUE.y);
    gl.uniform2f(u.uNexusRed, MOBAConfig.NEXUS.RED.x, MOBAConfig.NEXUS.RED.y);
    // The river pits (the dragon's and its mirror), see siegeMap.ts
    const [pit, otherPit] = MOBAConfig.RIVER.pits;
    gl.uniform4f(u.uPits, pit.x, pit.y, otherPit.x, otherPit.y);
    gl.uniform2f(u.uRiverDir, this.riverDirection[0], this.riverDirection[1]);
    gl.disable(gl.BLEND);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
}
