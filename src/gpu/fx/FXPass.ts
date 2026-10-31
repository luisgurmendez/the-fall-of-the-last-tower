/**
 * Draws a layer of effects (an FXBatch) into the WebGL canvas:
 * 1. every quad into a half-float target, light adding up past 1
 * 2. bloom: the bright parts downsampled four times and blurred back up
 *    (dual Kawase filter)
 * 3. composite: the light tone-mapped (bright cores go white instead of
 *    clipping) plus the bloom, premultiplied with the smoke's coverage
 */

import {
  createProgram,
  createRenderTarget,
  deleteRenderTarget,
  FULLSCREEN_VERTEX,
  type Program,
  type RenderTarget,
} from "../gl";
import type { GPUView } from "../view";
import { FX_INSTANCE_FLOATS, type FXBatch } from "./FXBatch";
import { FX_FRAGMENT, FX_UNIFORMS, FX_VERTEX } from "./fxShader";

/** How far bloom spreads: the number of halvings */
const BLOOM_LEVELS = 4;
/** Light under this doesn't bloom */
const BLOOM_THRESHOLD = 0.55;
const BLOOM_STRENGTH = 0.7;
/** World units per art pixel (the ground's) */
const PIXEL_SNAP = 1.5;

const DOWNSAMPLE = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uSource;
uniform vec2 uTexel;
uniform float uThreshold;
out vec4 outColor;
vec3 bright(vec3 c) {
  float peak = max(max(c.r, c.g), c.b);
  float soft = clamp(peak - uThreshold * 0.5, 0.0, uThreshold);
  soft = soft * soft / (4.0 * uThreshold + 0.0001);
  return c * max(soft, peak - uThreshold) / max(peak, 0.0001);
}
void main() {
  vec3 sum = texture(uSource, vUv).rgb * 4.0;
  sum += texture(uSource, vUv + uTexel * vec2(-1.0, -1.0)).rgb;
  sum += texture(uSource, vUv + uTexel * vec2(1.0, -1.0)).rgb;
  sum += texture(uSource, vUv + uTexel * vec2(-1.0, 1.0)).rgb;
  sum += texture(uSource, vUv + uTexel * vec2(1.0, 1.0)).rgb;
  sum /= 8.0;
  outColor = vec4(uThreshold > 0.0 ? bright(sum) : sum, 1.0);
}`;

const UPSAMPLE = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uSource;
uniform vec2 uTexel;
out vec4 outColor;
void main() {
  vec3 sum = texture(uSource, vUv + uTexel * vec2(-2.0, 0.0)).rgb;
  sum += texture(uSource, vUv + uTexel * vec2(2.0, 0.0)).rgb;
  sum += texture(uSource, vUv + uTexel * vec2(0.0, -2.0)).rgb;
  sum += texture(uSource, vUv + uTexel * vec2(0.0, 2.0)).rgb;
  sum += texture(uSource, vUv + uTexel * vec2(-1.0, -1.0)).rgb * 2.0;
  sum += texture(uSource, vUv + uTexel * vec2(1.0, -1.0)).rgb * 2.0;
  sum += texture(uSource, vUv + uTexel * vec2(-1.0, 1.0)).rgb * 2.0;
  sum += texture(uSource, vUv + uTexel * vec2(1.0, 1.0)).rgb * 2.0;
  outColor = vec4(sum / 12.0, 1.0);
}`;

const COMPOSITE = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uScene;
uniform sampler2D uBloom;
uniform float uBloomStrength;
out vec4 outColor;
void main() {
  vec4 scene = texture(uScene, vUv);
  vec3 bloom = texture(uBloom, vUv).rgb * uBloomStrength;
  vec3 light = 1.0 - exp(-(scene.rgb + bloom));
  outColor = vec4(light, clamp(scene.a, 0.0, 1.0));
}`;

export class FXPass {
  private readonly program: Program;
  private readonly downsample: Program;
  private readonly upsample: Program;
  private readonly composite: Program;
  private readonly vao: WebGLVertexArrayObject;
  private readonly instanceBuffer: WebGLBuffer;
  private scene: RenderTarget | null = null;
  private bloom: RenderTarget[] = [];

  constructor(private readonly gl: WebGL2RenderingContext, private readonly halfFloat: boolean) {
    this.program = createProgram(gl, FX_VERTEX, FX_FRAGMENT, FX_UNIFORMS);
    this.downsample = createProgram(gl, FULLSCREEN_VERTEX, DOWNSAMPLE, ["uSource", "uTexel", "uThreshold"]);
    this.upsample = createProgram(gl, FULLSCREEN_VERTEX, UPSAMPLE, ["uSource", "uTexel"]);
    this.composite = createProgram(gl, FULLSCREEN_VERTEX, COMPOSITE, ["uScene", "uBloom", "uBloomStrength"]);

    this.vao = gl.createVertexArray()!;
    gl.bindVertexArray(this.vao);
    const corners = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, corners);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    this.instanceBuffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuffer);
    const stride = FX_INSTANCE_FLOATS * 4;
    for (let attribute = 0; attribute < 5; attribute++) {
      gl.enableVertexAttribArray(attribute + 1);
      gl.vertexAttribPointer(attribute + 1, 4, gl.FLOAT, false, stride, attribute * 16);
      gl.vertexAttribDivisor(attribute + 1, 1);
    }
    gl.bindVertexArray(null);
  }

  private resize(width: number, height: number): void {
    if (this.scene && this.scene.width === width && this.scene.height === height) return;
    const gl = this.gl;
    if (this.scene) deleteRenderTarget(gl, this.scene);
    for (const target of this.bloom) deleteRenderTarget(gl, target);
    this.scene = createRenderTarget(gl, width, height, this.halfFloat);
    this.bloom = [];
    let w = width;
    let h = height;
    for (let level = 0; level < BLOOM_LEVELS; level++) {
      w = Math.max(1, Math.floor(w / 2));
      h = Math.max(1, Math.floor(h / 2));
      this.bloom.push(createRenderTarget(gl, w, h, this.halfFloat));
    }
  }

  private fullscreen(program: Program, target: RenderTarget | null, width: number, height: number): void {
    const gl = this.gl;
    gl.useProgram(program.program);
    gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.framebuffer : null);
    gl.viewport(0, 0, width, height);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  /**
   * Draw the batch into the canvas (cleared first), with bloom.
   */
  draw(batch: FXBatch, view: GPUView): void {
    const gl = this.gl;
    this.resize(view.width, view.height);
    const scene = this.scene!;

    // 1. The quads
    gl.bindFramebuffer(gl.FRAMEBUFFER, scene.framebuffer);
    gl.viewport(0, 0, scene.width, scene.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(this.program.program);
    const u = this.program.uniforms;
    gl.uniform2f(u.uViewOrigin, view.originX, view.originY);
    gl.uniform1f(u.uWorldPerPixel, view.worldPerPixel);
    gl.uniform2f(u.uResolution, view.width, view.height);
    gl.uniform1f(u.uTime, view.time);
    gl.uniform1f(u.uPixelSnap, PIXEL_SNAP);
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, batch.data.subarray(0, batch.count * FX_INSTANCE_FLOATS), gl.STREAM_DRAW);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, batch.count);
    gl.bindVertexArray(null);
    gl.disable(gl.BLEND);

    // 2. Bloom: down the chain, keeping only the bright parts on the first step...
    gl.activeTexture(gl.TEXTURE0);
    let source: RenderTarget = scene;
    for (let level = 0; level < this.bloom.length; level++) {
      const target = this.bloom[level];
      gl.useProgram(this.downsample.program);
      gl.bindTexture(gl.TEXTURE_2D, source.texture);
      gl.uniform1i(this.downsample.uniforms.uSource, 0);
      gl.uniform2f(this.downsample.uniforms.uTexel, 1 / source.width, 1 / source.height);
      gl.uniform1f(this.downsample.uniforms.uThreshold, level === 0 ? BLOOM_THRESHOLD : 0);
      this.fullscreen(this.downsample, target, target.width, target.height);
      source = target;
    }
    // ...and back up, each level adding the blurred one below it
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    for (let level = this.bloom.length - 1; level > 0; level--) {
      const from = this.bloom[level];
      const target = this.bloom[level - 1];
      gl.useProgram(this.upsample.program);
      gl.bindTexture(gl.TEXTURE_2D, from.texture);
      gl.uniform1i(this.upsample.uniforms.uSource, 0);
      gl.uniform2f(this.upsample.uniforms.uTexel, 0.5 / from.width, 0.5 / from.height);
      this.fullscreen(this.upsample, target, target.width, target.height);
    }
    gl.disable(gl.BLEND);

    // 3. Composite into the canvas
    gl.useProgram(this.composite.program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, scene.texture);
    gl.uniform1i(this.composite.uniforms.uScene, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.bloom[0].texture);
    gl.uniform1i(this.composite.uniforms.uBloom, 1);
    gl.uniform1f(this.composite.uniforms.uBloomStrength, BLOOM_STRENGTH);
    this.fullscreen(this.composite, null, view.width, view.height);
    gl.activeTexture(gl.TEXTURE0);
  }
}
