import DefaultVertexShader from './DefaultVertexShader.js';

export const VignetteShader = {

	uniforms: {

		"tDiffuse": null,
		"vignetteOffset": 1.0,
		"vignetteDarkness": 1.0

	},

	vertexShader: DefaultVertexShader,

	fragmentShader: `

		uniform sampler2D tDiffuse;

		uniform float vignetteOffset;
		uniform float vignetteDarkness;

		varying vec2 v_Uv;

		void main() {

			vec4 color = texture2D(tDiffuse, v_Uv);
			vec2 uv = (v_Uv - vec2(0.5)) * vec2(vignetteOffset);
			color.rgb = mix(color.rgb, vec3(1.0 - vignetteDarkness), dot(uv, uv));
			gl_FragColor = color;

		}

	`

}