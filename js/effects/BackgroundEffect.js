import * as zen3d from '../../libs/zen3d/build/zen3d.module.js';
import { CopyShader } from '../../libs/zen3d/examples/jsm/shaders/CopyShader.js';
import { SkyBox } from '../../libs/zen3d/examples/jsm/objects/SkyBox.js';

import { AbstractEffect } from "../AbstractEffect.js";

export class BackgroundEffect extends AbstractEffect {

	constructor(width, height) {
		super(width, height);

		this.backgroundColor = new zen3d.Color3();

		this.backgroundScene = new zen3d.Scene();
		this.backgroundCamera = new zen3d.Camera();
		this.backgroundCamera.outputEncoding = zen3d.TEXEL_ENCODING_TYPE.GAMMA;
		this.backgroundScene.add(this.backgroundCamera);

		this.skyBox = new SkyBox(null);
		this.skyBox.level = 8;
		this.skyBox.visible = false;
		this.skyBox.gamma = true;
		this.backgroundCamera.add(this.skyBox);

		this.copyPass = new zen3d.ShaderPostPass(CopyShader);
		this.copyPass.material.transparent = true;
	}

	set(val) {
		this.clear();

		if (val instanceof zen3d.Color3) {
			this.backgroundColor.copy(val);
		} else if (val instanceof zen3d.TextureCube) {
			this.skyBox.texture = val;
			this.skyBox.visible = true;
		} else if (val instanceof zen3d.Texture2D) {
			console.warn("Texture2D background is not supported yet!")
		} else {
			console.warn("unsupport background!")
		}
	}

	clear() {
		this.backgroundColor.setRGB(0, 0, 0);
		this.skyBox.visible = false;
	}

	apply(renderer, camera, input, output) {
		const glCore = renderer.glCore;

		glCore.renderTarget.setRenderTarget(output);

		glCore.state.colorBuffer.setClear(this.backgroundColor.r, this.backgroundColor.g, this.backgroundColor.b, 1);
		glCore.clear(true, true, true);

		this.backgroundCamera.copy(camera, false);

		this.backgroundScene.updateMatrix();

		glCore.render(this.backgroundScene, this.backgroundCamera);

		// clear depth?

		if (input) {
			this.copyPass.uniforms.tDiffuse = input.texture;
			this.copyPass.render(glCore);
		}
	}

}