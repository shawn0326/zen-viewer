export default `
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
`;