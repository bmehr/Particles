const PARTICLE_COUNT = 4000;
const PARTICLE_SIZE = 8 * 8;

async function initWebGPU() {
  const canvas = document.getElementById("webgpu-canvas");
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const adapter = await navigator.gpu.requestAdapter();
  const device = await adapter.requestDevice();
  const context = canvas.getContext("webgpu");
  const format = navigator.gpu.getPreferredCanvasFormat();

  context.configure({
    device,
    format,
    alphaMode: "opaque",
  });

  const initialParticles = new Float32Array(PARTICLE_COUNT * 4);
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const i4 = i * 4;
    initialParticles[i4 + 0] = Math.random() * 2 - 1;
    initialParticles[i4 + 1] = Math.random() * 2 - 1;
    initialParticles[i4 + 2] = (Math.random() - 0.5) * 0.01;
    initialParticles[i4 + 3] = (Math.random() - 0.5) * 0.01;
  }

  const bufferSize = Math.ceil(initialParticles.byteLength / 16) * 16;
  const particleBuffer = device.createBuffer({
    size: bufferSize,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    mappedAtCreation: true,
  });
  new Float32Array(particleBuffer.getMappedRange()).set(initialParticles);
  particleBuffer.unmap();

  // Load shaders
  const computeShaderModule = await fetch('shaders/compute.wgsl').then(res => res.text());
  const vertexShaderModule = await fetch('shaders/vertex.wgsl').then(res => res.text());

  const computeModule = device.createShaderModule({ code: computeShaderModule });
  const vertexModule = device.createShaderModule({ code: vertexShaderModule });

  // Separate bind group layouts
  const computeBindGroupLayout = device.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.COMPUTE,
        buffer: { type: "storage" },
      },
    ],
  });

  const renderBindGroupLayout = device.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX,
        buffer: { type: "read-only-storage" },
      },
    ],
  });

  const computeBindGroup = device.createBindGroup({
    layout: computeBindGroupLayout,
    entries: [
      { binding: 0, resource: { buffer: particleBuffer } },
    ],
  });

  const renderBindGroup = device.createBindGroup({
    layout: renderBindGroupLayout,
    entries: [
      { binding: 0, resource: { buffer: particleBuffer } },
    ],
  });

  const computePipeline = device.createComputePipeline({
    layout: device.createPipelineLayout({ bindGroupLayouts: [computeBindGroupLayout] }),
    compute: {
      module: computeModule,
      entryPoint: "main",
    },
  });

  const renderPipeline = device.createRenderPipeline({
    layout: device.createPipelineLayout({ bindGroupLayouts: [renderBindGroupLayout] }),
    vertex: {
      module: vertexModule,
      entryPoint: "main",
    },
    fragment: {
      module: vertexModule,
      entryPoint: "fs_main",
      targets: [{ format }],
    },
    primitive: {
      topology: "point-list",
    },
  });

  function frame() {
    const commandEncoder = device.createCommandEncoder();

    // Compute pass
    const computePass = commandEncoder.beginComputePass();
    computePass.setPipeline(computePipeline);
    computePass.setBindGroup(0, computeBindGroup);
    computePass.dispatchWorkgroups(Math.ceil(PARTICLE_COUNT / 64));
    computePass.end();

    // Render pass
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
    renderPass.draw(PARTICLE_COUNT);
    renderPass.end();

    device.queue.submit([commandEncoder.finish()]);
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

initWebGPU();


