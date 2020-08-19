import * as zen3d from '../libs/zen3d/build/zen3d.module.js';
import { GBuffer } from '../libs/zen3d/examples/jsm/GBuffer.js';
import { SuperSampling } from '../libs/zen3d/examples/jsm/SuperSampling.js';
import { CopyShader } from '../libs/zen3d/examples/jsm/shaders/CopyShader.js';
import { FXAAShader } from '../libs/zen3d/examples/jsm/shaders/FXAAShader.js';

import { BloomEffect } from './effects/BloomEffect.js';
import { SSAOEffect } from './effects/SSAOEffect.js';
import { SSREffect } from './effects/SSREffect.js';
import { ToneMappingEffect } from './effects/ToneMappingEffect.js';
import { VignetteEffect } from './effects/VignetteEffect.js';
import { BackgroundEffect } from './effects/BackgroundEffect.js';

import { RenderMode } from './const.js';

const oldProjectionMatrix = new zen3d.Matrix4();

class AdvancedRenderer {

	constructor(canvas) {
		const gl = canvas.getContext("webgl2", { antialias: false, alpha: false, stencil: true })
            || canvas.getContext("webgl", { antialias: true, alpha: false, stencil: true });

		this.glCore = new zen3d.WebGLCore(gl);

		console.info("WebGL Version: " + this.glCore.capabilities.version);

		const multipleSampling = this.glCore.capabilities.maxSamples;
		this.sampleRenderTarget = new zen3d.RenderTarget2D(canvas.width, canvas.height);
		this.sampleRenderTarget.attach(
			new zen3d.RenderBuffer(canvas.width, canvas.height, zen3d.WEBGL_PIXEL_FORMAT.RGBA8, multipleSampling),
			zen3d.ATTACHMENT.COLOR_ATTACHMENT0
		);
		this.sampleRenderTarget.attach(
			new zen3d.RenderBuffer(canvas.width, canvas.height, zen3d.WEBGL_PIXEL_FORMAT.DEPTH24_STENCIL8, multipleSampling),
			zen3d.ATTACHMENT.DEPTH_STENCIL_ATTACHMENT
		);

		this.tempRenderTarget = new zen3d.RenderTarget2D(canvas.width, canvas.height);
		this.tempRenderTarget.texture.minFilter = zen3d.WEBGL_TEXTURE_FILTER.LINEAR;
		this.tempRenderTarget.texture.magFilter = zen3d.WEBGL_TEXTURE_FILTER.LINEAR;
		this.tempRenderTarget.texture.generateMipmaps = false;

		this.tempRenderTarget2 = new zen3d.RenderTarget2D(canvas.width, canvas.height);
		this.tempRenderTarget2.texture.minFilter = zen3d.WEBGL_TEXTURE_FILTER.LINEAR;
		this.tempRenderTarget2.texture.magFilter = zen3d.WEBGL_TEXTURE_FILTER.LINEAR;
		this.tempRenderTarget2.texture.generateMipmaps = false;

		this.backRenderTarget = new zen3d.RenderTargetBack(canvas);

		this.gBuffer = new GBuffer(canvas.width, canvas.height);
		this.gBuffer.enableAlbedoMetalness = false;

		// this.shadowMapPass = new zen3d.ShadowMapPass();

		this.copyPass = new zen3d.ShaderPostPass(CopyShader);
		this.copyPass.material.transparent = true;
		this.fxaaPass = new zen3d.ShaderPostPass(FXAAShader);
		this.fxaaPass.material.transparent = true;
		this.fxaaPass.uniforms["resolution"] = [1 / canvas.width, 1 / canvas.height];

		this.superSampling = new SuperSampling(canvas.width, canvas.height, 30);

		this.ssaoEffect = new SSAOEffect(canvas.width, canvas.height);
		this.ssaoEffect.enable = false;

		this.ssrEffect = new SSREffect(canvas.width, canvas.height)
		this.ssrEffect.enable = false;

		this.bloomEffect = new BloomEffect(canvas.width, canvas.height);
		this.bloomEffect.enable = false;

		this.toneMappingEffect = new ToneMappingEffect(canvas.width, canvas.height);
		this.toneMappingEffect.enable = false;

		this.backgroundEffect = new BackgroundEffect(canvas.width, canvas.height);

		this.vignetteEffect = new VignetteEffect(canvas.width, canvas.height);
		this.vignetteEffect.enable = false;

		this._effects = [this.ssaoEffect, this.ssrEffect, this.bloomEffect, this.toneMappingEffect, this.backgroundEffect, this.vignetteEffect];

		this._matcapTexture = zen3d.Texture2D.fromSrc("assets/matcaps/matcap-collor.jpg");
		this._matcapMaterials = new Map();

		this.renderMode = RenderMode.DEFAULT;

		this.config = { taa: true, fxaa: false };
	}

	setBackground(val) {
		this.backgroundEffect.set(val);
		this.dirty();
	}

	clearBackground() {
		this.backgroundColor.clear();
		this.dirty();
	}

	resize(width, height) {
		this.sampleRenderTarget.resize(width, height);
		this.tempRenderTarget.resize(width, height);
		this.tempRenderTarget2.resize(width, height);

		this.backRenderTarget.resize(width, height);

		this.gBuffer.resize(width, height);

		this.superSampling.resize(width, height);

		this._effects.forEach(effect => effect.resize(width, height));

		this.fxaaPass.uniforms["resolution"] = [1 / width, 1 / height];

		this.dirty();
	}

	render(scene, camera) {
		if (this.glCore.capabilities.version >= 2) {
			let tex, read, write, temp;

			if (this.config.taa) {
				if (!this.superSampling.finished()) {
					oldProjectionMatrix.copy(camera.projectionMatrix);
					this.superSampling.jitterProjection(camera, this.backRenderTarget.width, this.backRenderTarget.height);

					this._renderToTempMSAA(scene, camera);

					read = this.tempRenderTarget;
					write = this.tempRenderTarget2;

					this._effects.forEach(effect => {
						if (effect.enable) {
							effect.apply(this, camera, read, write);
							temp = read;
							read = write;
							write = temp;
						}
					});

					camera.projectionMatrix.copy(oldProjectionMatrix);

					tex = this.superSampling.sample(this.glCore, read.texture);
				} else {
					tex = this.superSampling.output();
				}
			} else {
				this._renderToTempMSAA(scene, camera);

				read = this.tempRenderTarget;
				write = this.tempRenderTarget2;

				this._effects.forEach(effect => {
					if (effect.enable) {
						effect.apply(this, camera, read, write);
						temp = read;
						read = write;
						write = temp;
					}
				});

				tex = read.texture;
			}

			this.glCore.renderTarget.setRenderTarget(this.backRenderTarget);

			if (this.config.fxaa) {
				this.fxaaPass.uniforms.tDiffuse = tex;
				this.fxaaPass.render(this.glCore);
			} else {
				this.copyPass.uniforms.tDiffuse = tex;
				this.copyPass.render(this.glCore);
			}
		} else {
			scene.updateMatrix();
			scene.updateLights();

			scene.updateRenderList(camera);

			this.backgroundEffect.apply(this, camera, undefined, this.backRenderTarget);

			this._forwardRender(scene, camera);
		}
	}

	_renderToTempMSAA(scene, camera) {
		scene.updateMatrix();
		scene.updateLights();

		scene.updateRenderList(camera);

		if (this.ssaoEffect.enable || this.ssrEffect.enable) {
			this.gBuffer.update(this.glCore, scene, camera);
		}

		this.glCore.renderTarget.setRenderTarget(this.sampleRenderTarget);

		this.glCore.state.colorBuffer.setClear(0, 0, 0, 0);
		this.glCore.clear(true, true, true);

		this._forwardRender(scene, camera);

		this.glCore.renderTarget.setRenderTarget(this.tempRenderTarget);
		this.glCore.renderTarget.blitRenderTarget(this.sampleRenderTarget, this.tempRenderTarget);
	}

	_forwardRender(scene, camera) {
		var renderList = scene.getRenderList(camera);

		this.glCore.renderPass(renderList.opaque, camera, {
			scene: scene,
			getMaterial: renderable => {
				switch (this.renderMode) {
				case RenderMode.DEFAULT:
					return renderable.material;
				case RenderMode.MATCAP:
					return this._getMatcapMaterial(renderable.material);
				default:
					return renderable.material; // TODO
				}
			}
		});

		this.glCore.renderPass(renderList.transparent, camera, {
			scene: scene,
			getMaterial: renderable => {
				switch (this.renderMode) {
				case RenderMode.DEFAULT:
					return renderable.material;
				case RenderMode.MATCAP:
					return this._getMatcapMaterial(renderable.material);
				default:
					return renderable.material; // TODO
				}
			}
		});
	}

	_getMatcapMaterial(material) { // TODO dispose
		var matcapMaterial;
		if (!this._matcapMaterials.has(material)) {
			matcapMaterial = new zen3d.MatcapMaterial();
			matcapMaterial.matcap = this._matcapTexture;
			matcapMaterial.normalMap = material.normalMap;
			this._matcapMaterials.set(material, matcapMaterial);
		} else {
			matcapMaterial = this._matcapMaterials.get(material);
		}
		return matcapMaterial;
	}

	dirty() {
		this.superSampling.start();
		this._effects.forEach(effect => effect.dirty());
	}

}

export default AdvancedRenderer;