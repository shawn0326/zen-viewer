import { AbstractEffect } from "../AbstractEffect.js";
import { ToneMappingShader } from "../shaders/ToneMappingShader.js";

class ToneMappingEffect extends AbstractEffect {

	constructor(width, height) {
		super(width, height);

		this.type = "Linear";

		this.pass = new zen3d.ShaderPostPass(ToneMappingShader);
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

	updateType() {
		this.pass.material.defines["ToneMappingMethod"] = this.type + "ToneMapping";
		this.pass.material.needsUpdate = true;
	}

}

export const ToneMappingTypes = ["Linear", "Reinhard", "ACESFilmic"];

export { ToneMappingEffect };