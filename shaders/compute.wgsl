struct Particle {
  pos : vec2<f32>,
  vel : vec2<f32>,
};

@group(0) @binding(0) var<storage, read_write> particles : array<Particle>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id : vec3<u32>) {
  let index = id.x;
  if (index >= arrayLength(&particles)) {
    return;
  }

  particles[index].pos += particles[index].vel;

  // Simple bounds wrap
  if (particles[index].pos.x > 1.0) {
    particles[index].pos.x = -1.0;
  }
  if (particles[index].pos.x < -1.0) {
    particles[index].pos.x = 1.0;
  }
  if (particles[index].pos.y > 1.0) {
    particles[index].pos.y = -1.0;
  }
  if (particles[index].pos.y < -1.0) {
    particles[index].pos.y = 1.0;
  }
}
