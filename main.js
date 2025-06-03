async function initWebGPU() {
  if (!navigator.gpu) {
    alert("WebGPU not supported on this browser.");
    return;
  }

  const canvas = document.getElementById("webgpu-canvas");
  const adapter = await navigator.gpu.requestAdapter();
  const device = await adapter.requestDevice();

  const context = canvas.getContext("webgpu");
  const format = navigator.gpu.getPreferredCanvasFormat();
  context.configure({
    device,
    format,
    alphaMode: "opaque"
  });

  // Set canvas size
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  // We'll build the particle logic here next.
  console.log("WebGPU initialized!");
}

initWebGPU();
