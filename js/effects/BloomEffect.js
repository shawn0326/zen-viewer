import * as zen3d from '../../libs/zen3d/build/zen3d.module.js';
import { BlurPass } from '../../libs/zen3d/examples/jsm/pass/BlurPass.js';
import { LuminosityHighPassShader } from '../../libs/zen3d/examples/jsm/shaders/LuminosityHighPassShader.js';

import { AbstractEffect } from '../AbstractEffect.js';
import { AdditiveBlendShader } from '../shaders/AdditiveBlendShader.js';

class BloomEffect extends AbstractEffect {

	constructor(width, height) {
		super(width, height);

		this.highLightPass = new zen3d.ShaderPostPass(LuminosityHighPassShader);
		this.highLightPass.material.depthTest = false;
		this.highLightPass.material.depthWrite = false;

		this.blurPass = new BlurPass();
		this.blurPass.uniforms["textureSize"] = [width, height];
		this.blurPass.material.depthTest = false;
		this.blurPass.material.depthWrite = false;
		this.blurPass.setKernelSize(13);

		this.blendPass = new zen3d.ShaderPostPass(AdditiveBlendShader);
		this.blendPass.material.depthTest = false;
		this.blendPass.material.depthWrite = false;

		this.threshold = 0.7;
		this.intensity = 1;
		this.radius = 2;

		this.tempRenderTarget = new zen3d.RenderTarget2D(width, height);
		this.tempRenderTarget.texture.minFilter = zen3d.WEBGL_TEXTURE_FILTER.LINEAR;
		this.tempRenderTarget.texture.magFilter = zen3d.WEBGL_TEXTURE_FILTER.LINEAR;
		this.tempRenderTarget.texture.generateMipmaps = false;

		this.tempRenderTarget2 = new zen3d.RenderTarget2D(width, height);
		this.tempRenderTarget2.texture.minFilter = zen3d.WEBGL_TEXTURE_FILTER.LINEAR;
		this.tempRenderTarget2.texture.magFilter = zen3d.WEBGL_TEXTURE_FILTER.LINEAR;
		this.tempRenderTarget2.texture.generateMipmaps = false;

		this._dirty = true;
	}

	resize(width, height) {
		this.tempRenderTarget.resize(width, height);
		this.tempRenderTarget2.resize(width, height);

		this.blurPass.uniforms["textureSize"] = [width, height];

		this._dirty = true;
	}

	apply(renderer, camera, input, output) {
		const glCore = renderer.glCore;

		if (this._dirty) {
			glCore.renderTarget.setRenderTarget(this.tempRenderTarget);
			this.highLightPass.uniforms.luminosityThreshold = this.threshold;
			this.highLightPass.uniforms.tDiffuse = input.texture;
			this.highLightPass.render(glCore);

			glCore.renderTarget.setRenderTarget(this.tempRenderTarget2);
			this.blurPass.uniforms.tDiffuse = this.tempRenderTarget.texture;
			this.blurPass.uniforms.blurSize = this.radius;
			this.blurPass.uniforms.direction = 0;
			this.blurPass.render(glCore);

			glCore.renderTarget.setRenderTarget(this.tempRenderTarget);
			this.blurPass.uniforms.tDiffuse = this.tempRenderTarget2.texture;
			this.blurPass.uniforms.blurSize = this.radius;
			this.blurPass.uniforms.direction = 1;
			this.blurPass.render(glCore);

			this._dirty = false;
		}

		glCore.renderTarget.setRenderTarget(output);

		this.blendPass.uniforms.tDst = input.texture;
		this.blendPass.uniforms.tSrc = this.tempRenderTarget.texture;
		this.blendPass.uniforms.intensity = this.intensity;
		this.blendPass.render(glCore);
	}

	dirty() {
		this._dirty = true;
	}

}

export { BloomEffect };