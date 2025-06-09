function randomLightColorHex() {
    // Generate light color: each channel between 180 and 255
    const r = Math.floor(180 + Math.random() * 75);
    const g = Math.floor(180 + Math.random() * 75);
    const b = Math.floor(180 + Math.random() * 75);
    return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

const settings = {
    color: randomLightColorHex() ,
    particleCount: 100000,
    attractorStrength: 0.0002,
    attractorEnabled: false,
    showUI: true,
};

let globalSeed = Math.random() * 10000;
let seedBuffer;
let disruptActive = false;
let disruptBuffer;
let canvas, overlay, ctx;
let device, context, format;
let computePipeline, renderPipeline;
let computeBindGroupLayout, renderBindGroupLayout;
let computeBindGroup, renderBindGroup;
let uniformBuffer;
let particleBuffer;
let frameHandle;
let attractorBuffer;
let attractorPosition = { x: 0, y: 0 };
let isDraggingAttractor = false;

// GUI Setup
const gui = new lil.GUI();
gui.title('Particle Controls');
gui.addColor(settings, 'color').name('Color');
gui.add(settings, 'particleCount', 100, 200000).step(100).name('Count').onChange(() => {
    rebuildParticles();
});
gui.add(settings, 'attractorEnabled').name('Enable Attractor');
// gui.add(settings, 'attractorStrength', 0.00001, 0.01).step(0.00001).name('Attractor Strength');
// gui.add(settings, 'showUI').name('Show/Hide').onChange(v => v ? gui.show() : gui.hide());

function resizeCanvases() {
    const width = document.body.clientWidth;
    const height = document.body.clientHeight;
    canvas.width = width;
    canvas.height = height;
    overlay.width = width;
    overlay.height = height;
}

const resizeObserver = new ResizeObserver(() => {
    resizeCanvases();
    if (context && device && format) {
        context.configure({
            device,
            format,
            alphaMode: "opaque",
        });
    }
});
resizeObserver.observe(document.body);

function hexToRGB(hex) {
    const num = parseInt(hex.slice(1), 16);
    return {
        r: ((num >> 16) & 255) / 255,
        g: ((num >> 8) & 255) / 255,
        b: (num & 255) / 255,
    };
}

function rebuildParticles() {
    if (frameHandle) cancelAnimationFrame(frameHandle);

    const particleData = new Float32Array(settings.particleCount * 4);
    for (let i = 0; i < settings.particleCount; i++) {
        const i4 = i * 4;
        particleData[i4 + 0] = Math.random() * 2 - 1;
        particleData[i4 + 1] = Math.random() * 2 - 1;
        particleData[i4 + 2] = (Math.random() - 0.5) * 0.01;
        particleData[i4 + 3] = (Math.random() - 0.5) * 0.01;
    }

    const bufferSize = Math.ceil(particleData.byteLength / 16) * 16;
    particleBuffer = device.createBuffer({
        size: bufferSize,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        mappedAtCreation: true,
    });
    new Float32Array(particleBuffer.getMappedRange()).set(particleData);
    particleBuffer.unmap();

    computeBindGroup = device.createBindGroup({
        layout: computeBindGroupLayout,
        entries: [
            { binding: 0, resource: { buffer: particleBuffer } },
            { binding: 1, resource: { buffer: attractorBuffer } },
            { binding: 2, resource: { buffer: disruptBuffer } },
            { binding: 3, resource: { buffer: seedBuffer } },
        ],
    });

    renderBindGroup = device.createBindGroup({
        layout: renderBindGroupLayout,
        entries: [
            { binding: 0, resource: { buffer: particleBuffer } },
            { binding: 1, resource: { buffer: uniformBuffer } },
        ],
    });

    function frame() {
        const commandEncoder = device.createCommandEncoder();

        const buffer = new ArrayBuffer(16);
        const floatView = new Float32Array(buffer);
        const uintView = new Uint32Array(buffer);


        floatView[0] = attractorPosition.x;
        floatView[1] = attractorPosition.y;
        floatView[2] = settings.attractorStrength;
        uintView[3] = settings.attractorEnabled ? 1 : 0;


        device.queue.writeBuffer(attractorBuffer, 0, buffer);


        const color = hexToRGB(settings.color);
        const uniformData = new Float32Array([color.r, color.g, color.b, 1.0]);
        device.queue.writeBuffer(uniformBuffer, 0, uniformData.buffer);

        const disruptUniform = new Float32Array([disruptActive ? 1 : 0]);
        device.queue.writeBuffer(disruptBuffer, 0, disruptUniform.buffer);

        const computePass = commandEncoder.beginComputePass();
        computePass.setPipeline(computePipeline);
        computePass.setBindGroup(0, computeBindGroup);
        computePass.dispatchWorkgroups(Math.ceil(settings.particleCount / 64));
        computePass.end();

        const textureView = context.getCurrentTexture().createView();
        const renderPass = commandEncoder.beginRenderPass({
            colorAttachments: [{
                view: textureView,
                loadOp: "clear",
                storeOp: "store",
                clearValue: { r: 0, g: 0, b: 0, a: 1 },
            }],
        });


        renderPass.setPipeline(renderPipeline);
        renderPass.setBindGroup(0, renderBindGroup);
        renderPass.draw(settings.particleCount);
        renderPass.end();

        device.queue.submit([commandEncoder.finish()]);
        frameHandle = requestAnimationFrame(frame);

        ctx.clearRect(0, 0, overlay.width, overlay.height);
        // Fade trail effect
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.fillRect(0, 0, overlay.width, overlay.height);

        // Swirl ring effect
        const cx = (attractorPosition.x * 0.5 + 0.5) * overlay.width;
        const cy = (-attractorPosition.y * 0.5 + 0.5) * overlay.height;
        const pulse = Math.sin(performance.now() * 0.005) * 5 + 25;

        ctx.beginPath();
        ctx.arc(cx, cy, pulse, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255, 255, 100, 0.3)';
        ctx.lineWidth = 2;
        ctx.stroke();

        if (settings.attractorEnabled) {
            ctx.beginPath();
            ctx.arc(cx, cy, 18, 0, Math.PI * 2);
            ctx.fillStyle = isDraggingAttractor ? 'rgba(255,255,100,0.7)' : 'rgba(255,255,100,0.4)';
            ctx.fill();
            ctx.strokeStyle = 'rgba(255,255,100,0.8)';
            ctx.lineWidth = 2;
            ctx.stroke();
        }

    }



    frameHandle = requestAnimationFrame(frame);
}


async function initWebGPU() {
    canvas = document.getElementById("webgpu-canvas");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    overlay = document.getElementById("overlay");
    ctx = overlay.getContext("2d");
    overlay.width = window.innerWidth;
    overlay.height = window.innerHeight;


    const adapter = await navigator.gpu.requestAdapter();
    device = await adapter.requestDevice();
    context = canvas.getContext("webgpu");
    format = navigator.gpu.getPreferredCanvasFormat();

    context.configure({
        device,
        format,
        alphaMode: "opaque",
    });

    const computeCode = await fetch('shaders/compute.wgsl').then(r => r.text());
    const vertexCode = await fetch('shaders/vertex.wgsl').then(r => r.text());

    const computeModule = device.createShaderModule({ code: computeCode });
    const vertexModule = device.createShaderModule({ code: vertexCode });

    computeBindGroupLayout = device.createBindGroupLayout({
        entries: [
            { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
            { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
            { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
            { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } }, // seed
        ],
    });

    renderBindGroupLayout = device.createBindGroupLayout({
        entries: [
            { binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } },
            { binding: 1, visibility: GPUShaderStage.VERTEX, buffer: { type: 'uniform' } },
        ],
    });

    uniformBuffer = device.createBuffer({
        size: 16,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    attractorBuffer = device.createBuffer({
        size: 16, // 4 floats * 4 bytes
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    disruptBuffer = device.createBuffer({
        size: 4, // 1 float: active (0 or 1)
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    seedBuffer = device.createBuffer({
        size: 4,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(seedBuffer, 0, new Float32Array([globalSeed]));

    computePipeline = device.createComputePipeline({
        layout: device.createPipelineLayout({ bindGroupLayouts: [computeBindGroupLayout] }),
        compute: { module: computeModule, entryPoint: "main" },
    });

    renderPipeline = device.createRenderPipeline({
        layout: device.createPipelineLayout({ bindGroupLayouts: [renderBindGroupLayout] }),
        vertex: { module: vertexModule, entryPoint: "main" },
        fragment: { module: vertexModule, entryPoint: "fs_main", targets: [{ format }] },
        primitive: { topology: "point-list" },
    });



    rebuildParticles();
}

initWebGPU();

setTimeout(() => {
    disruptActive = true;
    setTimeout(() => {
        disruptActive = false;
    }, 500); // Disrupt for 0.5 seconds
}, 1000); // Start 1 second after load

function getMousePosInAttractorSpace(e) {
    const x = (e.clientX ?? e.touches?.[0]?.clientX ?? 0) / window.innerWidth;
    const y = (e.clientY ?? e.touches?.[0]?.clientY ?? 0) / window.innerHeight;
    return {
        x: x * 2 - 1,
        y: -(y * 2 - 1)
    };
}

// --- Attractor Dragging Events ---

canvas.addEventListener('mousedown', (e) => {
    if (!settings.attractorEnabled) return;
    const mouse = getMousePosInAttractorSpace(e);
    const dx = mouse.x - attractorPosition.x;
    const dy = mouse.y - attractorPosition.y;
    if (dx * dx + dy * dy < 0.08 * 0.08) { // 0.08 is the "hit" radius
        isDraggingAttractor = true;
    }
});

window.addEventListener('mousemove', (e) => {
    if (isDraggingAttractor && settings.attractorEnabled) {
        const mouse = getMousePosInAttractorSpace(e);
        attractorPosition.x = mouse.x;
        attractorPosition.y = mouse.y;
    }
});

window.addEventListener('mouseup', () => {
    isDraggingAttractor = false;
});

// Touch support
canvas.addEventListener('touchstart', (e) => {
    if (!settings.attractorEnabled) return;
    const mouse = getMousePosInAttractorSpace(e);
    const dx = mouse.x - attractorPosition.x;
    const dy = mouse.y - attractorPosition.y;
    if (dx * dx + dy * dy < 0.08 * 0.08) {
        isDraggingAttractor = true;
    }
});
window.addEventListener('touchmove', (e) => {
    if (isDraggingAttractor && settings.attractorEnabled) {
        const mouse = getMousePosInAttractorSpace(e);
        attractorPosition.x = mouse.x;
        attractorPosition.y = mouse.y;
    }
});
window.addEventListener('touchend', () => {
    isDraggingAttractor = false;
});


// function updateAttractorFromEvent(e) {
    // const x = (e.clientX ?? e.touches?.[0]?.clientX ?? 0) / window.innerWidth;
    // const y = (e.clientY ?? e.touches?.[0]?.clientY ?? 0) / window.innerHeight;
    // attractorPosition.x = x * 2 - 1;
    // attractorPosition.y = -(y * 2 - 1);
// }

// window.addEventListener('mousemove', updateAttractorFromEvent);
// window.addEventListener('touchmove', updateAttractorFromEvent);
