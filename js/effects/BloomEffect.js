const BloomShader = {

	uniforms: {

		"tDiffuse": null,
		"tBloom": null,
		"intensity": 1.0

	},

	vertexShader: [

		"attribute vec3 a_Position;",
		"attribute vec2 a_Uv;",

		"uniform mat4 u_Projection;",
		"uniform mat4 u_View;",
		"uniform mat4 u_Model;",

		"varying vec2 v_Uv;",

		"void main() {",

		"v_Uv = a_Uv;",
		"gl_Position = u_Projection * u_View * u_Model * vec4( a_Position, 1.0 );",

		"}"

	].join("\n"),

	fragmentShader: [

		"uniform sampler2D tDiffuse;",
		"uniform sampler2D tBloom;",

		"uniform float intensity;",

		"varying vec2 v_Uv;",

		"void main() {",

		"vec4 color = texture2D( tDiffuse, v_Uv );",
		"color.rgb += texture2D( tBloom, v_Uv ).rgb * intensity;",
		"gl_FragColor = color;",

		"}"

	].join("\n")

}

class BloomEffect {

	constructor(width, height) {
		this.highLightPass = new zen3d.ShaderPostPass(zen3d.LuminosityHighPassShader);

		this.blurPass = new zen3d.BlurPass(zen3d.BlurShader);
		this.blurPass.setKernelSize(13);

		this.bloomPass = new zen3d.ShaderPostPass(BloomShader);

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

		this.blurPass.uniforms.textureSize = [width, height];

		this._dirty = true;
	}

	apply(glCore, input, output) {
		if (this._dirty) {
			glCore.renderTarget.setRenderTarget(this.tempRenderTarget);
			glCore.state.colorBuffer.setClear(0, 0, 0, 1);
			glCore.clear(true, true, true);
			this.highLightPass.uniforms.luminosityThreshold = this.threshold;
			this.highLightPass.uniforms.tDiffuse = input.texture;
			this.highLightPass.render(glCore);

			glCore.renderTarget.setRenderTarget(this.tempRenderTarget2);
			glCore.state.colorBuffer.setClear(0, 0, 0, 1);
			glCore.clear(true, true, true);
			this.blurPass.uniforms.tDiffuse = this.tempRenderTarget.texture;
			this.blurPass.uniforms.blurSize = this.radius;
			this.blurPass.uniforms.direction = 0;
			this.blurPass.render(glCore);

			glCore.renderTarget.setRenderTarget(this.tempRenderTarget);
			glCore.state.colorBuffer.setClear(0, 0, 0, 1);
			glCore.clear(true, true, true);
			this.blurPass.uniforms.tDiffuse = this.tempRenderTarget2.texture;
			this.blurPass.uniforms.blurSize = this.radius;
			this.blurPass.uniforms.direction = 1;
			this.blurPass.render(glCore);
		}

		glCore.renderTarget.setRenderTarget(output);

		this.bloomPass.uniforms.tDiffuse = input.texture;
		this.bloomPass.uniforms.tBloom = this.tempRenderTarget.texture;
		this.bloomPass.uniforms.intensity = this.intensity;
		this.bloomPass.render(glCore);
	}

	dirty() {
		this._dirty = true;
	}

}

export { BloomEffect };