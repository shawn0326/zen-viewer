import * as zen3d from '../../libs/zen3d/build/zen3d.module.js';
import { SSRShader } from '../../libs/zen3d/examples/jsm/shaders/SSRShader.js';
import { BlurPass } from '../../libs/zen3d/examples/jsm/pass/BlurPass.js';

import { AbstractEffect } from '../AbstractEffect.js';
import { AdditiveBlendShader } from '../shaders/AdditiveBlendShader.js';

const projection = new zen3d.Matrix4();
const projectionInv = new zen3d.Matrix4();
const viewInverseTranspose = new zen3d.Matrix4();

class SSREffect extends AbstractEffect {

	constructor(width, height) {
		super(width, height);

		this.ssrPass = new zen3d.ShaderPostPass(SSRShader);
		this.ssrPass.uniforms.maxRayDistance = 200;
		this.ssrPass.uniforms.pixelStrideZCutoff = 50;
		this.ssrPass.uniforms.zThicknessThreshold = 1;
		this.ssrPass.uniforms["projection"] = projection.elements;
		this.ssrPass.uniforms["projectionInv"] = projectionInv.elements;
		this.ssrPass.uniforms["viewInverseTranspose"] = viewInverseTranspose.elements;
		this.ssrPass.uniforms["viewportSize"] = [width, height];

		this.blendPass = new zen3d.ShaderPostPass(AdditiveBlendShader);
		this.blendPass.material.depthTest = false;
		this.blendPass.material.depthWrite = false;

		this.blurPass = new BlurPass();
		this.blurPass.material.depthTest = false;
		this.blurPass.material.depthWrite = false;
		this.blurPass.material.defines["NORMALTEX_ENABLED"] = 1;
		this.blurPass.material.defines["DEPTHTEX_ENABLED"] = 1;
		this.blurPass.uniforms["projection"] = projection.elements;
		this.blurPass.uniforms["viewInverseTranspose"] = viewInverseTranspose.elements;
		this.blurPass.uniforms["blurSize"] = 2;
		this.blurPass.uniforms["depthRange"] = 1;
		this.blurPass.uniforms["textureSize"] = [width, height];

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

		this.ssrPass.uniforms["viewportSize"] = [width, height];
		this.blurPass.uniforms["textureSize"] = [width, height];

		this._dirty = true;
	}

	apply(renderer, camera, input, output) {
		const glCore = renderer.glCore;
		const gBuffer = renderer.gBuffer;

		if (this._dirty) {
			projection.copy(camera.projectionMatrix);
			projectionInv.copy(camera.projectionMatrix).inverse();
			viewInverseTranspose.copy(camera.worldMatrix).transpose();

			this.blurPass.uniforms["normalTex"] = gBuffer.getNormalGlossinessTexture();
			this.blurPass.uniforms["depthTex"] = gBuffer.getDepthTexture();

			this.ssrPass.uniforms["colorTex"] = input.texture;
			this.ssrPass.uniforms["gBufferTexture1"] = gBuffer.getNormalGlossinessTexture();
			this.ssrPass.uniforms["gBufferTexture2"] = gBuffer.getDepthTexture();

			// Step 1

			glCore.renderTarget.setRenderTarget(this.tempRenderTarget);
			glCore.state.colorBuffer.setClear(0, 0, 0, 0);
			glCore.clear(true, true, true);
			this.ssrPass.render(glCore);

			// Step 2

			glCore.renderTarget.setRenderTarget(this.tempRenderTarget2);
			this.blurPass.uniforms.tDiffuse = this.tempRenderTarget.texture;
			this.blurPass.uniforms.direction = 0;
			glCore.state.colorBuffer.setClear(0, 0, 0, 0);
			glCore.clear(true, true, true);
			this.blurPass.render(glCore);

			// Step 3

			glCore.renderTarget.setRenderTarget(this.tempRenderTarget);
			this.blurPass.uniforms.tDiffuse = this.tempRenderTarget2.texture;
			this.blurPass.uniforms.direction = 1;
			glCore.state.colorBuffer.setClear(0, 0, 0, 0);
			glCore.clear(true, true, true);
			this.blurPass.render(glCore);

			this._dirty = false;
		}

		glCore.renderTarget.setRenderTarget(output);

		this.blendPass.uniforms.tDst = input.texture;
		this.blendPass.uniforms.tSrc = this.tempRenderTarget.texture;
		this.blendPass.uniforms.intensity = 1;
		this.blendPass.render(glCore);
	}

	dirty() {
		this._dirty = true;
	}

}

export { SSREffect };