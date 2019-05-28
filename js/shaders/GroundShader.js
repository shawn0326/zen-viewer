export const GroundShader = {

	uniforms: {
		size: 30,
		color: [1., 1., 1., 1.],
		gridSize: 5,
		gridSize2: 1,
		gridColor: [0, 0, 0, 1],
		gridColor2: [0.5, 0.5, 0.5, 1],
		showGrid: false
	},

	vertexShader: `
        attribute vec3 a_Position;

        uniform mat4 u_Projection;
        uniform mat4 u_View;
        uniform mat4 u_Model;

        varying vec3 v_WorldPosition;

        void main() {
            v_WorldPosition = (u_Model * vec4( a_Position, 1.0 )).xyz;
            gl_Position = u_Projection * u_View * u_Model * vec4( a_Position, 1.0 );
        }
    `,

	fragmentShader: `

        uniform float size;
        uniform vec4 color;
        uniform float gridSize;
        uniform float gridSize2;
        uniform vec4 gridColor;
        uniform vec4 gridColor2;
        uniform bool showGrid;
		varying vec3 v_WorldPosition;

		void main() {

            gl_FragColor = color;

            if (showGrid) {
                float wx = v_WorldPosition.x;
                float wz = v_WorldPosition.z;
                float x0 = abs(fract(wx / gridSize - 0.5) - 0.5) / fwidth(wx) * gridSize / 2.0;
                float z0 = abs(fract(wz / gridSize - 0.5) - 0.5) / fwidth(wz) * gridSize / 2.0;
        
                float x1 = abs(fract(wx / gridSize2 - 0.5) - 0.5) / fwidth(wx) * gridSize2;
                float z1 = abs(fract(wz / gridSize2 - 0.5) - 0.5) / fwidth(wz) * gridSize2;
        
                float v0 = 1.0 - clamp(min(x0, z0), 0.0, 1.0);
                float v1 = 1.0 - clamp(min(x1, z1), 0.0, 1.0);
                if (v0 > 0.1) {
                    gl_FragColor = mix(gl_FragColor, gridColor, v0);
                } else {
                    gl_FragColor = mix(gl_FragColor, gridColor2, v1);
                }
            }

            gl_FragColor.a *= 1.0 - clamp(length(v_WorldPosition.xz) / size, 0.0, 1.0);

		}

	`

}