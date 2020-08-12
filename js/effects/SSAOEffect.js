import * as zen3d from '../../libs/zen3d/build/zen3d.module.js';
import { SSAOPass } from '../../libs/zen3d/examples/jsm/pass/SSAOPass.js';
import { BlurPass } from '../../libs/zen3d/examples/jsm/pass/BlurPass.js';

import { AbstractEffect } from '../AbstractEffect.js';
import { MultiplyBlendShader } from '../shaders/MultiplyBlendShader.js';

const projection = new zen3d.Matrix4();
const projectionInv = new zen3d.Matrix4();
const viewInverseTranspose = new zen3d.Matrix4();

class SSAOEffect extends AbstractEffect {

	constructor(width, height) {
		super(width, height);

		this._ssaoKernalSize = 32;

		this.ssaoPass = new SSAOPass();
		this.ssaoPass.material.depthTest = false;
		this.ssaoPass.material.depthWrite = false;
		this.ssaoPass.setNoiseSize(256);
		this.ssaoPass.uniforms["intensity"] = 1;
		this.ssaoPass.uniforms["power"] = 1;
		this.ssaoPass.uniforms["bias"] = 0.2;
		this.ssaoPass.uniforms["radius"] = 10;
		this.ssaoPass.uniforms["projection"] = projection.elements;
		this.ssaoPass.uniforms["projectionInv"] = projectionInv.elements;
		this.ssaoPass.uniforms["viewInverseTranspose"] = viewInverseTranspose.elements;
		this.ssaoPass.uniforms["texSize"][0] = width;
		this.ssaoPass.uniforms["texSize"][1] = height;

		this.blendPass = new zen3d.ShaderPostPass(MultiplyBlendShader);
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
		this._frame = 0;
	}

	resize(width, height) {
		this.tempRenderTarget.resize(width, height);

		this.ssaoPass.uniforms["texSize"] = [width, height];
		this.blurPass.uniforms["textureSize"] = [width, height];

		this._dirty = true;
	}

	apply(renderer, camera, input, output) {
		const glCore = renderer.glCore;
		const gBuffer = renderer.gBuffer;
		const frame = renderer.superSampling.frame();

		if (this._dirty || this._frame !== frame) {
			projection.copy(camera.projectionMatrix);
			projectionInv.copy(camera.projectionMatrix).inverse();
			viewInverseTranspose.copy(camera.worldMatrix).transpose();

			this.blurPass.uniforms["normalTex"] = gBuffer.getNormalGlossinessTexture();
			this.blurPass.uniforms["depthTex"] = gBuffer.getDepthTexture();

			this.ssaoPass.uniforms["normalTex"] = gBuffer.getNormalGlossinessTexture();
			this.ssaoPass.uniforms["depthTex"] = gBuffer.getDepthTexture();

			// Step 1

			glCore.renderTarget.setRenderTarget(this.tempRenderTarget);
			glCore.state.colorBuffer.setClear(1, 1, 1, 1);
			glCore.clear(true, false, false);
			this.ssaoPass.setKernelSize(this._ssaoKernalSize, frame);
			this.ssaoPass.render(glCore);

			// Step 2

			glCore.renderTarget.setRenderTarget(this.tempRenderTarget2);
			this.blurPass.uniforms.tDiffuse = this.tempRenderTarget.texture;
			this.blurPass.uniforms.direction = 0;
			this.blurPass.render(glCore);

			// Step 3

			glCore.renderTarget.setRenderTarget(this.tempRenderTarget);
			this.blurPass.uniforms.tDiffuse = this.tempRenderTarget2.texture;
			this.blurPass.uniforms.direction = 1;
			this.blurPass.render(glCore);

			this._dirty = false;
			this._frame = frame;
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

export { SSAOEffect };