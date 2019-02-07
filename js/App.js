import Viewer from './Viewer.js';

class App {

    constructor(el) {
        this.el = el;
        this.viewer = null;
        this.viewerEl = null;
        this.dropEl = document.querySelector('.dropzone');
        this.inputEl = document.querySelector('#file-input');

        this.createDropzone();
    }

    createDropzone() {
        const dropCtrl = new SimpleDropzone(this.dropEl, this.inputEl);
        dropCtrl.on('drop', ({files}) => this.load(files));
    }

    createViewer() {
        this.viewerEl = document.createElement('div');
        this.viewerEl.classList.add('viewer');
        this.dropEl.innerHTML = '';
        this.dropEl.appendChild(this.viewerEl);
        this.viewer = new Viewer(this.viewerEl);
        return this.viewer;
    }

    load(fileMap) {
        let rootFile;
        let rootPath;
        Array.from(fileMap).forEach(([path, file]) => {
            if (file.name.match(/\.(gltf|glb)$/)) {
                rootFile = file;
                rootPath = path.replace(file.name, '');
            }
        });
    
        if (!rootFile) {
            this.onError('No .gltf or .glb asset found.');
        }
    
        this.view(rootFile, rootPath, fileMap);
    }

    view(rootFile, rootPath, fileMap) {
        if (this.viewer) this.viewer.clear();
    
        const viewer = this.viewer || this.createViewer();
    
        const fileURL = typeof rootFile === 'string'
            ? rootFile
            : URL.createObjectURL(rootFile);
    
        viewer
            .load(fileURL, rootPath, fileMap)
            .catch((e) => this.onError(e));
    }

    onError(error) {
        let message = (error || {}).message || error.toString();
        if (message.match(/ProgressEvent/)) {
            message = 'Unable to retrieve this file. Check JS console and browser network tab.';
        } else if (message.match(/Unexpected token/)) {
            message = `Unable to parse file content. Verify that this file is valid. Error: "${message}"`;
        } else if (error && error.target && error.target instanceof Image) {
            error = 'Missing texture: ' + error.target.src.split('/').pop();
        }
        window.alert(message);
        console.error(error);
    }

}

document.addEventListener('DOMContentLoaded', () => {
    const app = new App(document.body, location);
});