import environments from '../assets/environment/index.js';

const MAP_NAMES = [
	'diffuseMap',
	'aoMap',
	'emissiveMap',
	'metalnessMap',
	'normalMap',
	'roughnessMap',
	'specularMap'
];

zen3d.DRACOLoader.setDecoderPath('libs/draco/');

const DEFAULT_CAMERA = '[default]';

class Viewer {

	constructor(el) {
		this.el = el;
		this.content = null;

		this.state = {
			environment: environments[1].name,
			actionStates: [],
			camera: DEFAULT_CAMERA
		};

		const canvas = document.createElement('canvas');
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

		this.defaultCamera = new zen3d.Camera();
		this.defaultCamera.gammaFactor = 2.2;
		this.defaultCamera.gammaOutput = true;
		this.defaultCamera._clip = [1, 1000];
		this.defaultCamera.setPerspective(60 / 180 * Math.PI, el.clientWidth / el.clientHeight, 1, 1000);
		this.scene.add(this.defaultCamera);

		this.activeCamera = this.defaultCamera;

		this.controls = new zen3d.OrbitControls(this.defaultCamera, canvas);

		this.clock = new zen3d.Clock();

		this.mixer = null;
		this.clips = [];

		this.gui = null;

		this.animFolder = null;
		this.animCtrls = [];

		this.addGUI();

		this.animate = this.animate.bind(this);
		requestAnimationFrame(this.animate);
		window.addEventListener('resize', this.resize.bind(this), false);
	}

	animate(time) {
		requestAnimationFrame(this.animate);
		this.controls.update();
		this.mixer && this.mixer.update(this.clock.getDelta());
		this.renderer.render(this.scene, this.activeCamera);
	}

	resize() {
		const { clientHeight, clientWidth } = this.el;

		this.defaultCamera.setPerspective(60 / 180 * Math.PI, clientWidth / clientHeight, this.defaultCamera._clip[0], this.defaultCamera._clip[1]);

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
			loader.setDRACOLoader(new zen3d.DRACOLoader());
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

		object.position.x += (object.position.x - center.x);
		object.position.y += (object.position.y - center.y);
		object.position.z += (object.position.z - center.z);

		this.controls.maxDistance = size * 10;

		const { clientHeight, clientWidth } = this.el;
		this.defaultCamera.setPerspective(60 / 180 * Math.PI, clientWidth / clientHeight, size / 100, size * 100);
		this.defaultCamera._clip[0] = size / 100;
		this.defaultCamera._clip[1] = size * 100;

		this.defaultCamera.position.copy(center);

		this.defaultCamera.position.x += size / 2.0;
		this.defaultCamera.position.y += size / 5.0;
		this.defaultCamera.position.z += size / 2.0;

		this.setCamera(DEFAULT_CAMERA);

		this.scene.add(object);
		this.content = object;

		this.setClips(clips);
		this.updateEnvironment();

		this.updateGUI();
	}

	updateEnvironment() {
		const environment = environments.filter(entry => entry.name === this.state.environment)[0];

		const { path, format } = environment;

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

	setClips(clips) {
		if (this.mixer) {
			this.mixer = null;
		}

		this.clips = clips;
		if (!clips.length) return;

		this.mixer = new zen3d.AnimationMixer();

		clips.forEach(clip => {
			this.mixer.add(clip);
		});
	}

	playAllClips() {
		this.clips.forEach(clip => {
			this.mixer.play(clip.name);
			this.state.actionStates[clip.name] = true;
		});
	}

	/**
     * @param {string} name
     */
	setCamera(name) {
		if (name === DEFAULT_CAMERA) {
			this.controls.enabled = true;
			this.activeCamera = this.defaultCamera;
		} else {
			this.controls.enabled = false;
			this.content.traverse((node) => {
				if (node.type = zen3d.OBJECT_TYPE.CAMERA && node.name === name) {
					this.activeCamera = node;
					node.gammaFactor = 2.2;
					node.gammaOutput = true;
				}
			});
		}
	}

	addGUI() {
		const gui = this.gui = new dat.GUI({ autoPlace: false, width: 260, hideable: true });

		// Animation controls.
		this.animFolder = gui.addFolder('Animation');
		this.animFolder.domElement.style.display = 'none';
		this.animFolder.add({ playAll: () => this.playAllClips() }, 'playAll');

		// Camera controls.
		this.cameraFolder = gui.addFolder('Cameras');
		this.cameraFolder.domElement.style.display = 'none';

		const guiWrap = document.createElement('div');
		this.el.appendChild(guiWrap);
		guiWrap.classList.add('gui-wrap');
		guiWrap.appendChild(gui.domElement);
		gui.open();
	}

	updateGUI() {
		this.cameraFolder.domElement.style.display = 'none';

		this.animCtrls.forEach(ctrl => ctrl.remove());
		this.animCtrls.length = 0;
		this.animFolder.domElement.style.display = 'none';

		const cameraNames = [];
		this.content.traverse(node => {
			if (node.type == zen3d.OBJECT_TYPE.CAMERA) {
				node.name = node.name || `VIEWER__camera_${cameraNames.length + 1}`;
				cameraNames.push(node.name);
			}
		});

		if (cameraNames.length) {
			this.cameraFolder.domElement.style.display = '';
			if (this.cameraCtrl) this.cameraCtrl.remove();
			const cameraOptions = [DEFAULT_CAMERA].concat(cameraNames);
			this.cameraCtrl = this.cameraFolder.add(this.state, 'camera', cameraOptions);
			this.cameraCtrl.onChange(name => this.setCamera(name));
		}

		if (this.clips.length) {
			this.animFolder.domElement.style.display = '';
			const actionStates = this.state.actionStates = {};
			this.clips.forEach((clip, clipIndex) => {
				// Autoplay the first clip.
				if (clipIndex === 0) {
					actionStates[clip.name] = true;
					this.mixer.play(clip.name);
				} else {
					actionStates[clip.name] = false;
				}

				// Play other clips when enabled.
				const ctrl = this.animFolder.add(actionStates, clip.name).listen();
				ctrl.onChange(playAnimation => {
					playAnimation ? this.mixer.play(clip.name) : this.mixer.stop(clip.name);
				});
				this.animCtrls.push(ctrl);
			});
		}
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

function extractUrlBase(url) {
	const index = url.lastIndexOf('/');
	if (index === -1) return './';
	return url.substr(0, index + 1);
}

function traverseMaterials(object, callback) {
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