export const VignetteShader = {

	uniforms: {

		"tDiffuse": null,
		"vignetteOffset": 1.0,
		"vignetteDarkness": 1.0

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