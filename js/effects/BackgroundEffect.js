import { AbstractEffect } from "../AbstractEffect.js";

export class BackgroundEffect extends AbstractEffect {

	constructor(width, height) {
		super(width, height);

		this.backgroundColor = new zen3d.Color3();

		this.backgroundScene = new zen3d.Scene();
		this.backgroundCamera = new zen3d.Camera();
		this.backgroundScene.add(this.backgroundCamera);

		this.skyBox = new zen3d.SkyBox(null);
		this.skyBox.level = 4;
		this.skyBox.visible = false;
		this.backgroundCamera.add(this.skyBox);

		this.copyPass = new zen3d.ShaderPostPass(zen3d.CopyShader);
		this.copyPass.material.transparent = true;
	}

	set(val) {
		this.clear();

		if (val instanceof zen3d.Color3) {
			this.backgroundColor.copy(val);
		} else if (val instanceof zen3d.TextureCube) {
			this.skyBox.material.cubeMap = val;
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