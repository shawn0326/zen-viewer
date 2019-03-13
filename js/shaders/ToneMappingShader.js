export const ToneMappingShader = {

	defines: {
		'ToneMappingMethod': 'LinearToneMapping'
	},

	uniforms: {

		"tDiffuse": null,

		"exposure": 0.0,

		"brightness": 0.0,
		"contrast": 1.0,
		"saturation": 1.0

	},

	vertexShader: `
        attribute vec3 a_Position;
		attribute vec2 a_Uv;

		uniform mat4 u_Projection;
		uniform mat4 u_View;
		uniform mat4 u_Model;

		varying vec2 v_Uv;

		void main() {
            v_Uv = a_Uv;
            gl_Position = u_Projection * u_View * u_Model * vec4( a_Position, 1.0 );
        }
    `,
	fragmentShader: `
        #ifndef saturate
            #define saturate(a) clamp( a, 0.0, 1.0 )
        #endif

        vec3 LinearToneMapping( vec3 color ) {
            return color;
        }

        // source: https://www.cs.utah.edu/~reinhard/cdrom/
        vec3 ReinhardToneMapping( vec3 color ) {
            return saturate( color / ( vec3( 1.0 ) + color ) );
        }

        // source: https://knarkowicz.wordpress.com/2016/01/06/aces-filmic-tone-mapping-curve/
        vec3 ACESFilmicToneMapping( vec3 color ) {
            return saturate( ( color * ( 2.51 * color + 0.03 ) ) / ( color * ( 2.43 * color + 0.59 ) + 0.14 ) );
        }

        uniform float exposure;

        uniform float brightness;
		uniform float contrast;
		uniform float saturation;

		uniform sampler2D tDiffuse;

		varying vec2 v_Uv;

		// Values from "Graphics Shaders: Theory and Practice" by Bailey and Cunningham
		const vec3 w = vec3(0.2125, 0.7154, 0.0721);

		void main() {

            vec4 tex = texture2D( tDiffuse, v_Uv );

            // brightness
            vec3 color = clamp(tex.rgb + vec3(brightness), 0.0, 1.0);
            // contrast
            color = clamp( (color-vec3(0.5))*contrast+vec3(0.5), 0.0, 1.0);
            // exposure
            color = clamp( color * pow(2.0, exposure), 0.0, 1.0);
            // saturation
            float luminance = dot( color, w );
            color = mix(vec3(luminance), color, saturation);

            color = ToneMappingMethod(color);

            gl_FragColor = vec4(color, tex.a);

		}

    `

}