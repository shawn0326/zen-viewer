export const MultiplyBlendShader = {

	uniforms: {

		"tDst": null,
		"tSrc": null,
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

		"uniform sampler2D tDst;",
		"uniform sampler2D tSrc;",

		"uniform float intensity;",

		"varying vec2 v_Uv;",

		"void main() {",

		"vec4 color = texture2D( tDst, v_Uv );",
		"color.rgb *= texture2D( tSrc, v_Uv ).rgb * intensity;",
		"gl_FragColor = color;",

		"}"

	].join("\n")

}