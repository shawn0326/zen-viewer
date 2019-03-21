import environments from '../assets/environment/index.js';
import AdvancedRenderer from './AdvancedRenderer.js';
import { ToneMappingTypes } from './effects/ToneMappingEffect.js';

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
		this.lights = [];

		this.state = {
			environment: environments[1].name,
			background: false,
			actionStates: [],
			camera: DEFAULT_CAMERA,
			skeleton: false,
			grid: false,
			addLights: true,
			textureEncoding: 'sRGB',
			ambientIntensity: 0.3,
			ambientColor: 0xFFFFFF,
			directIntensity: 0.8 * Math.PI, // TODO(#116)
			directColor: 0xFFFFFF
		};

		const canvas = document.createElement('canvas');
		canvas.width = el.clientWidth * window.devicePixelRatio;
		canvas.height = el.clientHeight * window.devicePixelRatio;
		canvas.style.width = el.clientWidth + "px";
		canvas.style.height = el.clientHeight + "px";
		this.canvas = canvas;
		this.el.appendChild(canvas);

		this.renderer = new AdvancedRenderer(canvas);
		this.renderer.setBackground(new zen3d.Color3(0.8, 0.8, 0.8));

		this.scene = new zen3d.Scene();

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
		this.skeletonHelpers = [];
		this.gridHelper = null;

		this.addGUI();

		this.animate = this.animate.bind(this);
		requestAnimationFrame(this.animate);
		window.addEventListener('resize', this.resize.bind(this), false);
	}

	animate(time) {
		requestAnimationFrame(this.animate);
		if (this.controls.update()) {
			this.renderer.dirty();
		}
		if (this.mixer) {
			this.renderer.dirty();
			this.mixer.update(this.clock.getDelta());
		}

		this.renderer.render(this.scene, this.activeCamera);
	}

	resize() {
		const { clientHeight, clientWidth } = this.el;

		this.defaultCamera.setPerspective(60 / 180 * Math.PI, clientWidth / clientHeight, this.defaultCamera._clip[0], this.defaultCamera._clip[1]);

		this.canvas.style.width = clientWidth + "px";
		this.canvas.style.height = clientHeight + "px";

		this.renderer.resize(clientWidth * window.devicePixelRatio, clientHeight * window.devicePixelRatio);
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

		this.controls.reset();

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

		this.controls.saveState();

		this.scene.add(object);
		this.content = object;

		this.setClips(clips);
		this.updateLights();
		this.updateEnvironment();
		this.updateTextureEncoding();
		this.updateDisplay();

		this.updateGUI();

		this.renderer.config.taa = !clips.length; // TODO
		this.renderer.dirty();
	}

	updateEnvironment() {
		const environment = environments.find(entry => entry.name === this.state.environment);

		this.getCubeMapTexture(environment).then(texture => {
			if (!!texture && this.state.background) {
				this.renderer.setBackground(texture);
			} else {
				this.renderer.setBackground(new zen3d.Color3(0.8, 0.8, 0.8));
			}

			traverseMaterials(this.content, material => {
				if (material.hasOwnProperty('envMap')) {
					material.envMap = texture;
					material.needsUpdate = true;
				}
			});

			this.renderer.dirty();
		});
	}

	getCubeMapTexture(environment) {
		const { path, format } = environment;

		// no envmap
		if (!path) return Promise.resolve(null);

		const cubeMapURLs = [
			path + 'posx' + format, path + 'negx' + format,
			path + 'posy' + format, path + 'negy' + format,
			path + 'posz' + format, path + 'negz' + format
		];

		const texture = zen3d.TextureCube.fromSrc(cubeMapURLs);

		return new Promise(resolve => {
			texture.addEventListener('onload', () => {
				resolve(texture);
			});
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
			if (!this.state.actionStates[clip.name]) {
				this.mixer.play(clip.name);
				this.state.actionStates[clip.name] = true;
			}
		});
	}

	stopAllClips() {
		this.clips.forEach(clip => {
			if (this.state.actionStates[clip.name]) {
				this.mixer.stop(clip.name);
				this.state.actionStates[clip.name] = false;
			}
		});
	}

	/**
     * @param {string} name
     */
	setCamera(name) {
		if (name === DEFAULT_CAMERA) {
			this.controls.enabled = true;
			this.defaultCamera.gammaOutput = this.activeCamera.gammaOutput;
			this.activeCamera = this.defaultCamera;
		} else {
			this.controls.enabled = false;
			this.content.traverse((node) => {
				if (node.type === zen3d.OBJECT_TYPE.CAMERA && node.name === name) {
					this.activeCamera = node;
					node.gammaFactor = 2.2;
					node.gammaOutput = this.defaultCamera.gammaOutput;
				}
			});
		}

		this.renderer.dirty();
	}

	updateTextureEncoding() {
		const encoding = this.state.textureEncoding === 'sRGB'
			? zen3d.TEXEL_ENCODING_TYPE.SRGB
			: zen3d.TEXEL_ENCODING_TYPE.LINEAR;
		traverseMaterials(this.content, (material) => {
			if (material.diffuseMap) material.diffuseMap.encoding = encoding;
			if (material.emissiveMap) material.emissiveMap.encoding = encoding;
			if (material.diffuseMap || material.emissiveMap) material.needsUpdate = true;
		});

		this.renderer.dirty();
	}

	updateLights() {
		const state = this.state;
		const lights = this.lights;

		if (state.addLights && !lights.length) {
			this.addLights();
		} else if (!state.addLights && lights.length) {
			this.removeLights();
		}

		if (lights.length === 2) {
			lights[0].intensity = state.ambientIntensity;
			lights[0].color.setHex(state.ambientColor);
			lights[1].intensity = state.directIntensity;
			lights[1].color.setHex(state.directColor);
		}

		this.renderer.dirty();
	}

	addLights() {
		const state = this.state;

		const ambientLight = new zen3d.AmbientLight();
		ambientLight.color.setHex(state.ambientColor);
		ambientLight.intensity = state.ambientIntensity;
		this.defaultCamera.add(ambientLight);

		const directionalLight = new zen3d.DirectionalLight();
		directionalLight.color.setHex(state.directColor);
		directionalLight.position.set(0.5, 0, 0.866); // ~60º
		directionalLight.intensity = state.directIntensity;
		directionalLight.lookAt(new zen3d.Vector3(), new zen3d.Vector3(0, 1, 0));
		this.defaultCamera.add(directionalLight);

		this.lights.push(ambientLight, directionalLight);
	}

	removeLights() {
		this.lights.forEach(light => light.parent.remove(light));
		this.lights.length = 0;
	}

	updateDisplay() {
		if (this.skeletonHelpers.length) {
			this.skeletonHelpers.forEach(helper => this.scene.remove(helper));
		}

		this.content.traverse(node => {
			if (node.geometry && node.skeleton && this.state.skeleton) {
				const helper = new zen3d.SkeletonHelper(this.scene);
				this.scene.add(helper);
				this.skeletonHelpers.push(helper);
			}
		});

		if (this.state.grid !== Boolean(this.gridHelper)) {
			if (this.state.grid) {
				this.gridHelper = new zen3d.GridHelper();
				this.scene.add(this.gridHelper);
			} else {
				this.scene.remove(this.gridHelper);
				this.gridHelper = null;
			}
		}

		this.renderer.dirty();
	}

	addGUI() {
		const gui = this.gui = new dat.GUI({ autoPlace: false, width: 260, hideable: true });

		// Display controls.
		const dispFolder = gui.addFolder('Display');
		const envBackgroundCtrl = dispFolder.add(this.state, 'background');
		envBackgroundCtrl.onChange(() => this.updateEnvironment());
		dispFolder.add(this.renderer.backgroundEffect.skyBox, 'level', 0, 8, 1).name('backgroundLOD').onChange(() => this.updateDisplay());
		const skeletonCtrl = dispFolder.add(this.state, 'skeleton');
		skeletonCtrl.onChange(() => this.updateDisplay());
		const gridCtrl = dispFolder.add(this.state, 'grid');
		gridCtrl.onChange(() => this.updateDisplay());
		dispFolder.add(this.controls, 'autoRotate');
		dispFolder.add(this.controls, 'screenSpacePanning');

		// Lighting controls.
		const lightFolder = gui.addFolder('Lighting');
		const encodingCtrl = lightFolder.add(this.state, 'textureEncoding', ['sRGB', 'Linear']);
		encodingCtrl.onChange(() => this.updateTextureEncoding());
		lightFolder.add(this.activeCamera, 'gammaOutput').onChange(() => this.renderer.dirty());
		const envMapCtrl = lightFolder.add(this.state, 'environment', environments.map(env => env.name));
		envMapCtrl.onChange(() => this.updateEnvironment());
		[
			lightFolder.add(this.state, 'addLights').listen(),
			lightFolder.add(this.state, 'ambientIntensity', 0, 2),
			lightFolder.addColor(this.state, 'ambientColor'),
			lightFolder.add(this.state, 'directIntensity', 0, 4),
			lightFolder.addColor(this.state, 'directColor')
		].forEach(ctrl => ctrl.onChange(() => this.updateLights()));

		// Animation controls.
		this.animFolder = gui.addFolder('Animation');
		this.animFolder.domElement.style.display = 'none';
		this.animFolder.add({ playAll: () => this.playAllClips() }, 'playAll');
		this.animFolder.add({ stopAll: () => this.stopAllClips() }, 'stopAll');

		// Camera controls.
		this.cameraFolder = gui.addFolder('Cameras');
		this.cameraFolder.domElement.style.display = 'none';

		// Effect controls.
		this.effectFolder = gui.addFolder('Effects');
		this.effectFolder.add(this.renderer.config, 'taa').listen().onChange(() => this.renderer.dirty());
		this.effectFolder.add(this.renderer.config, 'fxaa').onChange(() => this.renderer.dirty());
		const ssaoFolder = this.effectFolder.addFolder('ssao');
		ssaoFolder.add(this.renderer.ssaoEffect, 'enable').onChange(() => this.renderer.dirty());
		ssaoFolder.add(this.renderer.ssaoEffect.ssaoPass.uniforms, 'intensity', 0, 5, 0.1).onChange(() => this.renderer.dirty());
		ssaoFolder.add(this.renderer.ssaoEffect.ssaoPass.uniforms, 'radius', 0.1, 30, 0.1).onChange(() => this.renderer.dirty());
		ssaoFolder.add(this.renderer.ssaoEffect.ssaoPass.uniforms, 'bias', 0, 1, 0.01).onChange(() => this.renderer.dirty());
		const bloomFolder = this.effectFolder.addFolder('bloom');
		bloomFolder.add(this.renderer.bloomEffect, 'enable').onChange(() => this.renderer.dirty());
		bloomFolder.add(this.renderer.bloomEffect, 'threshold', 0, 1).onChange(() => this.renderer.dirty());
		bloomFolder.add(this.renderer.bloomEffect, 'intensity', 0, 5).onChange(() => this.renderer.dirty());
		bloomFolder.add(this.renderer.bloomEffect, 'radius', 0, 5).onChange(() => this.renderer.dirty());
		const toneMappingFolder = this.effectFolder.addFolder('tone mapping');
		toneMappingFolder.add(this.renderer.toneMappingEffect, 'enable').onChange(() => this.renderer.dirty());
		toneMappingFolder.add(this.renderer.toneMappingEffect, 'type', ToneMappingTypes).onChange(() => {
			this.renderer.toneMappingEffect.updateType();
			this.renderer.dirty()
		});
		toneMappingFolder.add(this.renderer.toneMappingEffect.pass.uniforms, 'exposure', 0, 1, 0.01).onChange(() => this.renderer.dirty());
		toneMappingFolder.add(this.renderer.toneMappingEffect.pass.uniforms, 'brightness', 0, 2, 0.01).onChange(() => this.renderer.dirty());
		toneMappingFolder.add(this.renderer.toneMappingEffect.pass.uniforms, 'contrast', 0, 2, 0.01).onChange(() => this.renderer.dirty());
		toneMappingFolder.add(this.renderer.toneMappingEffect.pass.uniforms, 'saturation', 0, 2, 0.01).onChange(() => this.renderer.dirty());
		const vignetteFolder = this.effectFolder.addFolder('vignette');
		vignetteFolder.add(this.renderer.vignetteEffect, 'enable').onChange(() => this.renderer.dirty());
		vignetteFolder.add(this.renderer.vignetteEffect.pass.uniforms, 'vignetteOffset', 0, 3, 0.01).onChange(() => this.renderer.dirty());
		vignetteFolder.add(this.renderer.vignetteEffect.pass.uniforms, 'vignetteDarkness', 0, 2, 0.01).onChange(() => this.renderer.dirty());

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
		this.content.traverse(node => {
			if (!node.geometry) return;
			node.geometry.dispose();
		});

		// dispose textures
		traverseMaterials(this.content, material => {
			MAP_NAMES.forEach(map => {
				if (material[map]) material[map].dispose();
			});
		});

		this.renderer.dirty();
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