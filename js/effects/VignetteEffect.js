import * as zen3d from '../../libs/zen3d/build/zen3d.module.js';

import { AbstractEffect } from "../AbstractEffect.js";
import { VignetteShader } from "../shaders/VignetteShader.js";

class VignetteEffect extends AbstractEffect {

	constructor(width, height) {
		super(width, height);

		this.pass = new zen3d.ShaderPostPass(VignetteShader);
		this.pass.material.transparent = true;
		this.pass.material.depthTest = false;
		this.pass.material.depthWrite = false;
	}

	apply(renderer, camera, input, output) {
		const glCore = renderer.glCore;

		glCore.renderTarget.setRenderTarget(output);

		glCore.state.colorBuffer.setClear(0, 0, 0, 0);
		glCore.clear(true, true, true);

		this.pass.uniforms.tDiffuse = input.texture;
		this.pass.render(glCore);
	}

}

export { VignetteEffect };