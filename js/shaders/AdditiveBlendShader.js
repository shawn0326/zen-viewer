import DefaultVertexShader from './DefaultVertexShader.js';

export const AdditiveBlendShader = {

	uniforms: {

		"tDst": null,
		"tSrc": null,
		"intensity": 1.0

	},

	vertexShader: DefaultVertexShader,

	fragmentShader: [

		"uniform sampler2D tDst;",
		"uniform sampler2D tSrc;",

		"uniform float intensity;",

		"varying vec2 v_Uv;",

		"void main() {",

		"vec4 color = texture2D( tDst, v_Uv );",
		"color.rgb += texture2D( tSrc, v_Uv ).rgb * intensity;",
		"gl_FragColor = color;",

		"}"

	].join("\n")

}