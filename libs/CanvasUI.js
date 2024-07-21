import {
    WebGLRenderer,
    Scene,
    PerspectiveCamera,
    CanvasTexture,
    Mesh,
    PlaneGeometry,
    MeshBasicMaterial,
    Raycaster,
    Matrix4,
    Vector3
} from 'three';

class CanvasUI {
    constructor(content, config) {
        this.content = content;
        this.config = config;

        this.renderer = undefined;
        this.scene = undefined;
        this.camera = undefined;
        this.mesh = undefined;
        this.controller = undefined;
        this.controller1 = undefined;

        this.intersectMesh = [];
        this.needsUpdate = true;

        this.raycaster = new Raycaster();
        this.mat4 = new Matrix4();
        this.vec3 = new Vector3();
        this.scrollData = [undefined, undefined];
        this.intersects = [undefined, undefined];
        this.selectedElements = [undefined, undefined];
        this.selectPressed = [false, false];

        this.texture = new CanvasTexture(this.createOffscreenCanvas(this.config.width, this.config.height));
        this.context = this.texture.image.getContext('2d');
        this.context.save();

        this.init();
    }

    init() {
        const canvas = this.texture.image;

        const geometry = new PlaneGeometry(this.config.width, this.config.height);
        const material = new MeshBasicMaterial({ map: this.texture });
        this.mesh = new Mesh(geometry, material);

        this.scene = new Scene();
        this.camera = new PerspectiveCamera(45, canvas.width / canvas.height, 0.1, 1000);
        this.camera.position.set(0, 0, 500);
        this.scene.add(this.mesh);

        this.renderer = new WebGLRenderer({ antialias: true });
        this.renderer.setSize(canvas.width, canvas.height);

        this.addController(0);
        this.addController(1);
    }

    addController(index) {
        const geometry = new PlaneGeometry(0.02, 0.02);
        const material = new MeshBasicMaterial({ color: 0xffffff });
        const mesh = new Mesh(geometry, material);

        if (index === 0) {
            this.controller = new Mesh(geometry, material);
            this.controller.add(mesh);

            const mesh2 = new Mesh(geometry, material);
            mesh2.visible = false;
            this.scene.add(mesh2);
            this.intersectMesh.push(mesh2);

            this.scene.add(this.controller);
        } else {
            this.controller1 = new Mesh(geometry, material);
            this.controller1.add(mesh);

            const mesh2 = new Mesh(geometry, material);
            mesh2.visible = false;
            this.scene.add(mesh2);
            this.intersectMesh.push(mesh2);

            this.scene.add(this.controller1);
        }
    }

    addHoverEffect(elm, hoverColor) {
        elm.hoverColor = hoverColor;
        elm.originalColor = elm.backgroundColor;

        elm.onHover = (hovered) => {
            if (hovered) {
                elm.backgroundColor = hoverColor;
            } else {
                elm.backgroundColor = elm.originalColor;
            }
            this.needsUpdate = true;
        };
    }

    checkHover(intersects, index) {
        const intersect = intersects[index];
        if (intersect) {
            const uv = intersect.uv;
            const x = uv.x * this.config.width;
            const y = (1 - uv.y) * this.config.height;

            const found = Object.entries(this.config).filter(([name, elm]) => {
                const pos = elm.position;
                if (elm.position === undefined) return false;
                return (elm.position.x <= x && elm.position.y <= y && (elm.position.x + elm.width) > x && (elm.position.y + elm.height) > y);
            });

            if (found.length > 0) {
                const elm = found[0][1];
                if (elm.onHover) {
                    elm.onHover(true);
                }
                return elm;
            }
        }
        return null;
    }

    updateController(index) {
        if (this.renderer === undefined || this.scene === undefined) return;

        const xrCamera = this.renderer.xr.getCamera();

        const controller = (index === 0) ? this.controller : this.controller1;
        if (controller.visible) {
            this.mat4.identity().extractRotation(controller.matrixWorld);
            this.raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
            this.raycaster.ray.direction.set(0, 0, -1).applyMatrix4(this.mat4);

            const intersects = this.raycaster.intersectObject(this.mesh, true);
            if (intersects.length > 0) {
                const p = intersects[0].point;
                const panel = this.mesh;
                this.vec3.copy(p);
                panel.worldToLocal(this.vec3);
                const uv = intersects[0].uv;
                const x = uv.x * this.config.width;
                const y = (1 - uv.y) * this.config.height;

                const elm = this.checkHover(intersects, index);
                if (elm) {
                    this.intersects[index] = intersects[0];
                    this.selectedElements[index] = elm;
                    if (elm.overflow == "scroll" && this.selectPressed[index]) {
                        const data = this.scrollData[index];
                        const dy = data.rayY - this.getIntersectY(index);
                        elm.scrollY = Math.min(Math.max(data.scrollY + dy, 0), elm.maxScroll);
                        this.needsUpdate = true;
                    }
                    if (this.intersectMesh !== undefined) {
                        const mesh = this.intersectMesh[index];
                        mesh.position.copy(this.vec3);
                        mesh.visible = true;
                        mesh.quaternion.copy(xrCamera.quaternion);
                    }
                    return;
                }
            }
        }

        this.selectedElements[index] = undefined;
        if (this.intersectMesh !== undefined) {
            const mesh = this.intersectMesh[index];
            mesh.visible = false;
        }
    }

    addShape(name, shape) {
        this.content[name] = { shape };
        this.config[name] = { type: "shape" };
        this.needsUpdate = true;
    }

    update() {
        const context = this.context;

        if (this.keyboard) this.keyboard.update();

        this.updateController(0);
        this.updateController(1);

        if (this.needsUpdate) {
            context.clearRect(0, 0, this.config.width, this.config.height);
            this.drawElement(this.config.body);

            Object.entries(this.content).forEach(([name, value]) => {
                const elm = this.config[name];
                if (elm !== undefined) this.drawElement(elm);
            });

            context.restore();
            context.save();

            this.texture.needsUpdate = true;
        }

        if (this.keyboard && this.keyboard.visible) this.needsUpdate = true;
    }

    drawElement(elm) {
        if (elm === undefined) return;
        const context = this.context;

        const body = this.config.body;
        const width = (elm.width !== undefined) ? elm.width : this.config.width;
        const height = (elm.height !== undefined) ? elm.height : this.config.height;
        const pos = (elm.position !== undefined) ? elm.position : { x: 0, y: 0 };

        if (elm.backgroundColor !== undefined) {
            const r = (elm.borderRadius !== undefined) ? elm.borderRadius : body.borderRadius;
            context.fillStyle = elm.backgroundColor;
            context.beginPath();
            context.moveTo(pos.x + r, pos.y);
            context.lineTo(pos.x + width - r, pos.y);
            context.quadraticCurveTo(pos.x + width, pos.y, pos.x + width, pos.y + r);
            context.lineTo(pos.x + width, pos.y + height - r);
            context.quadraticCurveTo(pos.x + width, pos.y + height, pos.x + width - r, pos.y + height);
            context.lineTo(pos.x + r, pos.y + height);
            context.quadraticCurveTo(pos.x, pos.y + height, pos.x, pos.y + height - r);
            context.lineTo(pos.x, pos.y + r);
            context.quadraticCurveTo(pos.x, pos.y, pos.x + r, pos.y);
            context.closePath();
            context.fill();
        }

        if (elm.backgroundImage !== undefined) {
            const image = elm.backgroundImage;
            const padding = (elm.padding !== undefined) ? elm.padding : body.padding;
            context.drawImage(image, pos.x, pos.y, elm.width, elm.height);
        }

        if (elm.fontColor !== undefined) context.fillStyle = elm.fontColor;
        else context.fillStyle = body.fontColor;

        if (elm.fontSize !== undefined) context.font = elm.fontSize + "px " + elm.fontFamily;
        else context.font = body.fontSize + "px " + body.fontFamily;

        if (elm.textAlign !== undefined) context.textAlign = elm.textAlign;
        else context.textAlign = "left";

        if (elm.type === "text" && elm.overflow === "scroll") {
            const padding = (elm.padding !== undefined) ? elm.padding : body.padding;
            const metrics = context.measureText(this.content[elm.name]);
            const textHeight = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;
            elm.maxScroll = Math.max(0, textHeight - elm.height);
            const scrollY = (elm.scrollY !== undefined) ? elm.scrollY : 0;
            const maxScroll = elm.maxScroll || 0;
            context.save();
            context.beginPath();
            context.rect(pos.x, pos.y, width, height);
            context.clip();
            context.fillText(this.content[elm.name], pos.x + padding, pos.y + padding - scrollY);
            context.restore();
        }

        if (elm.type === "text" && elm.overflow !== "scroll") {
            const padding = (elm.padding !== undefined) ? elm.padding : body.padding;
            context.fillText(this.content[elm.name], pos.x + padding, pos.y + padding);
        }

        if (elm.type === "button") {
            const padding = (elm.padding !== undefined) ? elm.padding : body.padding;
            context.fillText(this.content[elm.name], pos.x + padding, pos.y + padding);
        }

        if (elm.type === "shape") {
            const shape = this.content[elm.name].shape;
            context.fillStyle = shape.color;
            context.beginPath();
            context.moveTo(shape.points[0].x, shape.points[0].y);
            shape.points.forEach((point) => context.lineTo(point.x, point.y));
            context.closePath();
            context.fill();
        }
    }

    getIntersectY(index) {
        if (this.intersects[index] === undefined) return;
        const uv = this.intersects[index].uv;
        return uv.y * this.config.height;
    }

    onClick(index, pressed) {
        this.selectPressed[index] = pressed;
        if (pressed) {
            if (this.selectedElements[index] !== undefined) {
                const elm = this.selectedElements[index];
                if (elm.onClick !== undefined) elm.onClick();
                if (elm.overflow == "scroll") {
                    this.scrollData[index] = {
                        scrollY: elm.scrollY,
                        rayY: this.getIntersectY(index)
                    };
                }
            }
        }
    }
}

// Example usage
const content = {
    logo: "Welcome to MMU",
};

const config = {
    body: { 
        borderRadius: 20, 
        padding: 20, 
        fontFamily: "Arial", 
        fontSize: 20, 
        fontColor: "#FFFFFF" 
    },
    logo: { 
        type: "text", 
        position: { x: 50, y: 50 }, 
        width: 400, 
        height: 50, 
        backgroundColor: "#000000", 
        borderRadius: 10 
    }
};

const canvasUI = new CanvasUI(content, config);
canvasUI.addHoverEffect(config.logo, "#FF0000");

config.logo.onClick = () => {
    alert("Logo clicked!");
};

function animate() {
    requestAnimationFrame(animate);
    canvasUI.update();
    canvasUI.renderer.render(canvasUI.scene, canvasUI.camera);
}

animate();