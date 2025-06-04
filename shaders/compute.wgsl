struct Particle {
  pos : vec2<f32>,
  vel : vec2<f32>,
};

struct Attractor {
  pos: vec2<f32>,
};

@group(0) @binding(0) var<storage, read_write> particles : array<Particle>;
@group(0) @binding(1) var<uniform> attractor : Attractor;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id : vec3<u32>) {
  let index = id.x;
  if (index >= arrayLength(&particles)) {
    return;
  }
 // Attraction force toward the attractor position
  let direction = attractor.pos - particles[index].pos;
  let distance = length(direction) + 0.001;
  let force = normalize(direction) / (distance * distance); // inverse square
  particles[index].vel += force * 0.002; // tweak strength

  // Update position
  particles[index].pos += particles[index].vel;

  // Wrap around screen bounds
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
