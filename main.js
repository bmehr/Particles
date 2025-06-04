const settings = {
  color: '#ffff00',
  particleCount: 1000,
  attractorStrength: 0.002,
  attractorEnabled: true,
  showUI: true,
};

let device, context, format;
let computePipeline, renderPipeline;
let computeBindGroupLayout, renderBindGroupLayout;
let computeBindGroup, renderBindGroup;
let uniformBuffer;
let particleBuffer;
let frameHandle;
let attractorBuffer;
let attractorPosition = { x: 0, y: 0 };

// GUI Setup
const gui = new lil.GUI();
gui.title('Particle Controls');
gui.addColor(settings, 'color').name('Color');
gui.add(settings, 'particleCount', 100, 20000).step(100).name('Count').onChange(() => {
  rebuildParticles();
});
gui.add(settings, 'attractorEnabled').name('Enable Attractor');
gui.add(settings, 'attractorStrength', 0.0, 0.01).step(0.0001).name('Attractor Strength');
gui.add(settings, 'showUI').name('Show/Hide').onChange(v => v ? gui.show() : gui.hide());

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

floatView[0] = attractorPosition.x;
floatView[1] = attractorPosition.y;
floatView[2] = settings.attractorStrength;
uintView[3]  = settings.attractorEnabled ? 1 : 0;

device.queue.writeBuffer(attractorBuffer, 0, buffer);

    device.queue.writeBuffer(
    attractorBuffer,
    0,
    new Float32Array([
    attractorPosition.x,
    attractorPosition.y,
    settings.attractorStrength,
    settings.attractorEnabled ? 1 : 0
  ])
  );

    const color = hexToRGB(settings.color);
    const uniformData = new Float32Array([color.r, color.g, color.b, 1.0]);
    device.queue.writeBuffer(uniformBuffer, 0, uniformData.buffer);

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
  }

  frameHandle = requestAnimationFrame(frame);
}

async function initWebGPU() {
  const canvas = document.getElementById("webgpu-canvas");
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

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

function updateAttractorFromEvent(e) {
  const x = (e.clientX ?? e.touches?.[0]?.clientX ?? 0) / window.innerWidth;
  const y = (e.clientY ?? e.touches?.[0]?.clientY ?? 0) / window.innerHeight;
  attractorPosition.x = x * 2 - 1;
  attractorPosition.y = -(y * 2 - 1);
  console.log("Mouse moved to", attractorPosition.x, attractorPosition.y);
}

window.addEventListener('mousemove', updateAttractorFromEvent);
window.addEventListener('touchmove', updateAttractorFromEvent);
console.log(attractorPosition);
console.log(settings.attractorStrength, settings.attractorEnabled);

