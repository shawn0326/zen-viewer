import environments from '../assets/environment/index.js';

const MAP_NAMES = [
    'diffuseMap',
    'aoMap',
    'emissiveMap',
    'metalnessMap',
    'normalMap',
    'roughnessMap',
    'specularMap',
];

class Viewer {

    constructor(el) {
        this.el = el;
        this.content = null;

        this.state = {
            environment: environments[1].name
        };

        const canvas = document.createElement( 'canvas' );
        canvas.width = el.clientWidth * window.devicePixelRatio;
        canvas.height = el.clientHeight * window.devicePixelRatio;
        canvas.style.width = el.clientWidth + "px";
        canvas.style.height = el.clientHeight + "px";
        this.canvas = canvas;
        this.el.appendChild(canvas);

        this.renderer = new zen3d.Renderer(canvas);
        this.renderer.glCore.state.colorBuffer.setClear(0.8, 0.8, 0.8);

        this.scene = new zen3d.Scene();

        var ambientLight = new zen3d.AmbientLight();
        ambientLight.intensity = 0.3 * 3.14;
        this.scene.add(ambientLight);

        var directionalLight = new zen3d.DirectionalLight(0xffffff);
        directionalLight.position.set(-30, 30, 0);
        directionalLight.intensity = 0.8 * 3.14;
        directionalLight.lookAt(new zen3d.Vector3(), new zen3d.Vector3(0, 1, 0));
        this.scene.add(directionalLight);

        this.camera = new zen3d.Camera();
        this.camera.gammaFactor = 2.2;
        // this.camera.gammaInput = true;
        this.camera.gammaOutput = true;
        this.camera._clip = [1, 1000];
        this.camera.setPerspective(60 / 180 * Math.PI, el.clientWidth / el.clientHeight, 1, 1000);
        this.scene.add(this.camera);

        this.controls = new zen3d.OrbitControls(this.camera, canvas);

        this.clock = new zen3d.Clock();

        this.mixer = null;

        this.animate = this.animate.bind(this);
        requestAnimationFrame(this.animate);
        window.addEventListener('resize', this.resize.bind(this), false);
    }

    animate(time) {
        requestAnimationFrame(this.animate);
        this.controls.update();
        this.mixer && this.mixer.update(this.clock.getDelta());
		this.renderer.render(this.scene, this.camera);
    }

    resize() {
        const {clientHeight, clientWidth} = this.el;

        this.camera.setPerspective(60 / 180 * Math.PI, clientWidth / clientHeight, this.camera._clip[0], this.camera._clip[1]);
        
        this.canvas.width = clientWidth * window.devicePixelRatio;
        this.canvas.height = clientHeight * window.devicePixelRatio;
        this.canvas.style.width = clientWidth + "px";
        this.canvas.style.height = clientHeight + "px";

        this.renderer.backRenderTarget.resize(clientWidth * window.devicePixelRatio, clientHeight * window.devicePixelRatio);
    }

    load(url, rootPath, assetMap) {
        const baseURL = extractUrlBase(url);

        // Load.
        return new Promise((resolve, reject) => {
            const manager = new zen3d.LoadingManager();
    
            // Intercept and override relative URLs.
            manager.setURLModifier((url, path) => {
                const normalizedURL = rootPath + url
                .replace(baseURL, '')
                .replace(/^(\.?\/)/, '');

                if (assetMap.has(normalizedURL)) {
                    const blob = assetMap.get(normalizedURL);
                    const blobURL = URL.createObjectURL(blob);
                    blobURLs.push(blobURL);
                    return blobURL;
                }

                return (path || '') + url;
            });

            const loader = new zen3d.GLTFLoader(manager);
            const blobURLs = [];

            loader.load(url, (gltf) => {
                blobURLs.forEach(URL.revokeObjectURL);
                this.setContent(gltf.scene, gltf.animations);
                resolve(gltf);
            });
        });
    }

    setContent(object, clips) {
        this.clear();

        const box = getBoundingBox(object);
        const center = box.getCenter(new zen3d.Vector3());
        const size = new zen3d.Vector3().subVectors(box.max, box.min).getLength();

        this.scene.position.x += (this.scene.position.x - center.x);
        this.scene.position.y += (this.scene.position.y - center.y);
        this.scene.position.z += (this.scene.position.z - center.z);

        this.controls.maxDistance = size * 10;

        const {clientHeight, clientWidth} = this.el;
        this.camera.setPerspective(60 / 180 * Math.PI, clientWidth / clientHeight, size / 100, size * 100);
        this.camera._clip[0] = size / 100;
        this.camera._clip[1] = size * 100;

        this.camera.position.copy(center);

        this.camera.position.x += size / 2.0;
        this.camera.position.y += size / 5.0;
        this.camera.position.z += size / 2.0;

        this.scene.add(object);
        this.content = object;

        if (clips.length > 0) {
            this.mixer = new zen3d.AnimationMixer();
            this.mixer.add(clips[0]);
            this.mixer.play(clips[0].name);
        }

        this.updateEnvironment();
    }

    updateEnvironment() {
        const environment = environments.filter(entry => entry.name === this.state.environment)[0];

        const {path, format} = environment;

        const cubeMapURLs = [
            path + 'posx' + format, path + 'negx' + format,
            path + 'posy' + format, path + 'negy' + format,
            path + 'posz' + format, path + 'negz' + format
        ];

        const envMap = zen3d.TextureCube.fromSrc(cubeMapURLs);
        envMap.format = zen3d.WEBGL_PIXEL_FORMAT.RGB;

        traverseMaterials(this.content, material => {
            if (material.hasOwnProperty('envMap')) {
                material.envMap = envMap;
                material.needsUpdate = true;
            }
        });
    }

    clear() {
        if (!this.content) return;
    
        this.scene.remove(this.content);
    
        // dispose geometry
        this.content.traverse((node) => {
          if (!node.isMesh) return;
          node.geometry.dispose();
        });
    
        // dispose textures
        traverseMaterials(this.content, material => {
          MAP_NAMES.forEach(map => {
            if (material[map]) material[map].dispose();
          });
        });
    }

}

function extractUrlBase( url ) {
    const index = url.lastIndexOf('/');
    if (index === - 1) return './';
    return url.substr(0, index + 1);
}

function traverseMaterials (object, callback) {
    object.traverse((node) => {
        if (!node.material) return;
        const materials = Array.isArray(node.material)
            ? node.material
            : [node.material];
        materials.forEach(callback);
    });
}

function getBoundingBox(object) {
    const box = new zen3d.Box3();
    const _childBox = new zen3d.Box3();

    object.updateMatrix();

    object.traverse(node => {
        if (node.geometry) {
            node.geometry.computeBoundingBox();
            _childBox.copy(node.geometry.boundingBox).applyMatrix4(node.worldMatrix);
            box.expandByBox3(_childBox);
        }
    });

    return box;
}

export default Viewer;