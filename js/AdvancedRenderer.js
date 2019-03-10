import { BloomEffect } from './effects/BloomEffect.js';
import { SSAOEffect } from './effects/SSAOEffect.js';

const oldProjectionMatrix = new zen3d.Matrix4();

class AdvancedRenderer {

	constructor(canvas) {
		const gl = canvas.getContext("webgl2", { antialias: false, alpha: false, stencil: true })
            || canvas.getContext("webgl", { antialias: true, alpha: false, stencil: true });

		this.glCore = new zen3d.WebGLCore(gl);

		console.info("WebGL Version: " + this.glCore.capabilities.version);

		this.sampleRenderTarget = new zen3d.RenderTarget2D(canvas.width, canvas.height);
		this.sampleRenderTarget.multipleSampling = this.glCore.capabilities.maxSamples;

		this.tempRenderTarget = new zen3d.RenderTarget2D(canvas.width, canvas.height);
		this.tempRenderTarget.texture.minFilter = zen3d.WEBGL_TEXTURE_FILTER.LINEAR;
		this.tempRenderTarget.texture.magFilter = zen3d.WEBGL_TEXTURE_FILTER.LINEAR;
		this.tempRenderTarget.texture.generateMipmaps = false;

		this.tempRenderTarget2 = new zen3d.RenderTarget2D(canvas.width, canvas.height);
		this.tempRenderTarget2.texture.minFilter = zen3d.WEBGL_TEXTURE_FILTER.LINEAR;
		this.tempRenderTarget2.texture.magFilter = zen3d.WEBGL_TEXTURE_FILTER.LINEAR;
		this.tempRenderTarget2.texture.generateMipmaps = false;

		this.backRenderTarget = new zen3d.RenderTargetBack(canvas);

		this.gBuffer = new zen3d.GBuffer(canvas.width, canvas.height);
		this.gBuffer.enableAlbedoMetalness = false;

		// this.shadowMapPass = new zen3d.ShadowMapPass();

		this.copyPass = new zen3d.ShaderPostPass(zen3d.CopyShader);
		this.copyPass.material.transparent = true;
		this.fxaaPass = new zen3d.ShaderPostPass(zen3d.FXAAShader);
		this.fxaaPass.material.transparent = true;
		this.fxaaPass.uniforms["resolution"] = [1 / canvas.width, 1 / canvas.height];

		this.superSampling = new zen3d.SuperSampling(canvas.width, canvas.height, 30);

		this.bloomEffect = new BloomEffect(canvas.width, canvas.height);

		this.ssaoEffect = new SSAOEffect(canvas.width, canvas.height);

		this.config = { taa: true, fxaa: false, bloom: false, ssao: false };
	}

	resize(width, height) {
		this.sampleRenderTarget.resize(width, height);
		this.tempRenderTarget.resize(width, height);
		this.tempRenderTarget2.resize(width, height);

		this.backRenderTarget.resize(width, height);

		this.gBuffer.resize(width, height);

		this.superSampling.resize(width, height);

		this.bloomEffect.resize(width, height);
		this.ssaoEffect.resize(width, height);

		this.fxaaPass.uniforms["resolution"] = [1 / width, 1 / height];

		this.dirty();
	}

	render(scene, camera, clear, forceSimple) {
		clear = clear !== undefined ? clear : true;
		forceSimple = forceSimple !== undefined ? forceSimple : false;

		if (this.glCore.capabilities.version >= 2 && !forceSimple) {
			let tex, read, write, temp;

			if (this.config.taa) {
				if (!this.superSampling.finished()) {
					oldProjectionMatrix.copy(camera.projectionMatrix);
					this.superSampling.jitterProjection(camera, this.backRenderTarget.width, this.backRenderTarget.height);

					this._renderToTempMSAA(scene, camera);

					read = this.tempRenderTarget;
					write = this.tempRenderTarget2;

					if (this.config.ssao) {
						this.ssaoEffect.apply(this.glCore, this.gBuffer, camera, read, write, this.superSampling.frame());
						temp = read;
						read = write;
						write = temp;
					}

					if (this.config.bloom) {
						this.bloomEffect.apply(this.glCore, read, write);
						temp = read;
						read = write;
						write = temp;
					}

					camera.projectionMatrix.copy(oldProjectionMatrix);

					tex = this.superSampling.sample(this.glCore, read.texture);
				} else {
					tex = this.superSampling.output();
				}
			} else {
				this._renderToTempMSAA(scene, camera);

				read = this.tempRenderTarget;
				write = this.tempRenderTarget2;

				if (this.config.ssao) {
					this.ssaoEffect.apply(this.glCore, this.gBuffer, camera, read, write, 0);
					temp = read;
					read = write;
					write = temp;
				}

				if (this.config.bloom) {
					this.bloomEffect.apply(this.glCore, read, write);
					temp = read;
					read = write;
					write = temp;
				}

				tex = read.texture;
			}

			this.glCore.renderTarget.setRenderTarget(this.backRenderTarget);

			if (clear) {
				this.glCore.state.colorBuffer.setClear(0, 0, 0, 0);
				this.glCore.clear(true, true, true);
			}

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

			this.glCore.renderTarget.setRenderTarget(this.backRenderTarget);

			if (clear) {
				this.glCore.state.colorBuffer.setClear(0.8, 0.8, 0.8, 1);
				this.glCore.clear(true, true, true);
			}

			this.glCore.render(scene, camera);
		}
	}

	_renderToTempMSAA(scene, camera) {
		scene.updateMatrix();
		scene.updateLights();

		scene.updateRenderList(camera);

		if (this.config.ssao) {
			this.gBuffer.update(this.glCore, scene, camera);
		}

		this.glCore.renderTarget.setRenderTarget(this.sampleRenderTarget);

		this.glCore.state.colorBuffer.setClear(0, 0, 0, 0);
		this.glCore.clear(true, true, true);

		this.glCore.render(scene, camera, false);

		this.glCore.renderTarget.setRenderTarget(this.tempRenderTarget);
		this.glCore.renderTarget.blitRenderTarget(this.sampleRenderTarget, this.tempRenderTarget);
	}

	dirty() {
		this.superSampling.start();
		this.bloomEffect.dirty();
	}

}

export default AdvancedRenderer;