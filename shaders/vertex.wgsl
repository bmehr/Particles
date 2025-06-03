struct Particle {
  pos : vec2<f32>,
  vel : vec2<f32>,
};

struct Uniforms {
  color: vec4<f32>,
};

@group(0) @binding(0) var<storage, read> particles : array<Particle>;
@group(0) @binding(1) var<uniform> uniforms : Uniforms;

struct VertexOutput {
  @builtin(position) position : vec4<f32>,
  @location(0) color : vec4<f32>,
};

@vertex
fn main(@builtin(vertex_index) vertexIndex : u32) -> VertexOutput {
  var out : VertexOutput;
  let pos = particles[vertexIndex].pos;
  out.position = vec4<f32>(pos, 0.0, 1.0);
  out.color = uniforms.color;
  return out;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
  return in.color;
}
