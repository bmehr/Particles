const PARTICLE_COUNT = 1000;
const PARTICLE_SIZE = 4 * 4;

let computeBindGroupLayout;
let renderBindGroupLayout;
let uniformBuffer;


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

  const settings = {
  color: '#ffff00',      // yellow default
  particleSize: 1,
  particleCount: 1000,
  showUI: true,
};

const gui = new lil.GUI();
gui.title('Particle Controls');

gui.addColor(settings, 'color').name('Color');
gui.add(settings, 'particleSize', 1, 10).step(1).name('Size');
gui.add(settings, 'particleCount', 100, 5000).step(100).name('Count');
gui.add(settings, 'showUI').name('Show/Hide').onChange((v) => {
  v ? gui.show() : gui.hide();
});
  
let currentParticleCount = settings.particleCount;

gui.add(settings, 'particleCount', 100, 5000).step(100).name('Count').onChange(() => {
  if (settings.particleCount !== currentParticleCount) {
    currentParticleCount = settings.particleCount;
    rebuildParticles(); // 🔧 we’ll define this next
  }
});

let frameHandle;
let computeBindGroup, renderBindGroup;
let particleBuffer;

function rebuildParticles() {
  if (frameHandle) cancelAnimationFrame(frameHandle); // stop old loop

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
    entries: [{ binding: 0, resource: { buffer: particleBuffer } }],
  });

  renderBindGroup = device.createBindGroup({
    layout: renderBindGroupLayout,
    entries: [
      { binding: 0, resource: { buffer: particleBuffer } },
      { binding: 1, resource: { buffer: uniformBuffer } },
    ],
  });
function rebuildParticles()
  function frame() {
    const commandEncoder = device.createCommandEncoder();

    // update uniforms
    const color = hexToRGB(settings.color);
    const uniformData = new Float32Array([color.r, color.g, color.b, 1.0]);
    device.queue.writeBuffer(uniformBuffer, 0, uniformData.buffer);

    // compute pass
    const computePass = commandEncoder.beginComputePass();
    computePass.setPipeline(computePipeline);
    computePass.setBindGroup(0, computeBindGroup);
    computePass.dispatchWorkgroups(Math.ceil(settings.particleCount / 64));
    computePass.end();

    // render pass
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

rebuildParticles();
}
initWebGPU();


