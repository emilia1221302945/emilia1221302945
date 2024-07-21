class CanvasUI {
    constructor(config) {
        this.config = config;
        this.context = this.initContext();
        this.content = {};
        this.selectedElements = [null, null];
        this.needsUpdate = true;
        this.texture = { needsUpdate: false };
    }

    initContext() {
        // Initialize the canvas context here
        let canvas = document.createElement('canvas');
        canvas.width = this.config.width || 800;
        canvas.height = this.config.height || 600;
        return canvas.getContext('2d');
    }

    setClip(config) {
        if (config.clip) {
            this.context.beginPath();
            this.context.rect(config.position.x, config.position.y, config.width, config.height);
            this.context.clip();
        }
    }

    wrapText(name, content) {
        const config = this.config[name] || this.config.body;
        const context = this.context;
        const pos = config.position || { x: 0, y: 0 };
        const width = config.width || this.config.width;
        const height = config.height || this.config.height;
        const padding = config.padding || this.config.body.padding;
        const fontSize = config.fontSize || this.config.body.fontSize;
        const fontFamily = config.fontFamily || this.config.body.fontFamily;
        const textAlign = config.textAlign || "center";

        context.textAlign = textAlign;
        context.font = `${fontSize}px ${fontFamily}`;

        const lines = content.split('\n');
        const lineHeight = fontSize * 1.2;
        let y = pos.y + padding;

        lines.forEach(line => {
            const textWidth = context.measureText(line).width;
            const x = (textAlign === 'center') ? pos.x + width / 2 : 
                      (textAlign === 'right') ? pos.x + width - textWidth - padding : 
                      pos.x + padding;
            context.fillText(line, x, y);
            y += lineHeight;
        });

        // Adjust height based on text block
        const textHeight = lines.length * lineHeight;
        if (config.height === undefined) {
            config.height = textHeight + padding * 2; // Added padding to the height
        }
    }

    update() {
        if (this.mesh === undefined) {
            console.error('Mesh is undefined.');
            return;
        }

        if (this.controller) this.handleController(this.controller, 0);
        if (this.controller1) this.handleController(this.controller1, 1);

        if (this.keyboard && this.keyboard.visible) this.keyboard.update();

        if (!this.needsUpdate) return;

        let context = this.context;

        context.clearRect(0, 0, this.config.width, this.config.height);

        const bgColor = this.config.body.backgroundColor || "#000";
        const fontFamily = this.config.body.fontFamily || "Arial";
        const fontColor = this.config.body.fontColor || "#fff";
        const fontSize = this.config.body.fontSize || 30;

        console.log(`Update canvas with width: ${this.config.width}, height: ${this.config.height}`);

        this.setClip(this.config.body);
        context.fillStyle = bgColor;
        context.fillRect(0, 0, this.config.width, this.config.height);

        Object.entries(this.content).forEach(([name, content]) => {
            const config = this.config[name] || this.config.body;
            const display = config.display || 'block';

            if (display !== 'none') {
                const pos = config.position || { x: 0, y: 0 };
                const width = config.width || this.config.width;
                const height = config.height || this.config.height;

                if (config.type == "button" && !content.toLowerCase().startsWith("<path>")) {
                    config.borderRadius = config.borderRadius || 6;
                    config.textAlign = config.textAlign || "center";
                }

                this.setClip(config);

                const svgPath = content.toLowerCase().startsWith("<path>");
                const hover = ((this.selectedElements[0] && this.selectedElements[0] === config) || 
                                (this.selectedElements[1] && this.selectedElements[1] === config));

                if (config.backgroundColor !== undefined) {
                    context.fillStyle = hover && config.type === "button" && config.hover !== undefined ? config.hover : config.backgroundColor;
                    context.fillRect(pos.x, pos.y, width, height);
                }

                if (config.type == "text" || config.type == "button" || config.type == "input-text") {
                    let stroke = false;
                    if (hover) {
                        context.fillStyle = (config.fontColor !== undefined) ? config.fontColor : fontColor;
                        stroke = (config.hover === undefined);
                    } else {
                        context.fillStyle = (config.fontColor !== undefined) ? config.fontColor : fontColor;
                    }

                    if (svgPath) {
                        const code = content.toUpperCase().substring(6, content.length - 7);
                        context.save();
                        context.translate(pos.x, pos.y);
                        const path = new Path2D(code);
                        context.fill(path);
                        context.restore();
                    } else {
                        this.wrapText(name, content);
                    }

                    if (stroke) {
                        context.beginPath();
                        context.strokeStyle = "#fff";
                        context.lineWidth = 2;
                        context.rect(pos.x, pos.y, width, height);
                        context.stroke();
                    }
                } else if (config.type == "img") {
                    if (config.img === undefined) {
                        this.loadImage(content).then(img => {
                            console.log(`Image loaded: width ${img.width}, height ${img.height}`);
                            config.img = img;
                            this.needsUpdate = true;
                            this.update();
                        }).catch(err => console.error('Image load error:', err));
                    } else {
                        const aspect = config.img.width / config.img.height;
                        const h = width / aspect;
                        context.drawImage(config.img, pos.x, pos.y, width, h);
                    }
                }
            }
        });

        this.needsUpdate = false;
        this.texture.needsUpdate = true;
    }

    loadImage(src) {
        return new Promise((resolve, reject) => {
            let img = new Image();
            img.src = src;
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
        });
    }

    handleController(controller, index) {
        // Handle controller input here
    }
}
