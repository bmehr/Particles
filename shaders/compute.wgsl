struct Particle {
  pos : vec2<f32>,
  vel : vec2<f32>,
};

struct Attractor {
  pos: vec2<f32>,
  strength: f32,
  enabled: u32,
};

@group(0) @binding(0) var<storage, read_write> particles : array<Particle>;
@group(0) @binding(1) var<uniform> attractor : Attractor;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id : vec3<u32>) {
  let index = id.x;
  if (index >= arrayLength(&particles)) {
    return;
  }
 // Attraction force toward the attractor position and strength
 if (attractor.enabled == 1u) {
  let direction = attractor.pos - particles[index].pos;
  let distance = length(direction) + 0.001;
  let force = normalize(direction) / (distance * distance);
  particles[index].vel += force * attractor.strength;

// ✅ Respawn particle if it's too close
  if (distance < 0.03) {
    particles[index].pos = vec2<f32>(0.0, 0.0);
    // Add a basic pseudo-random velocity using index (GPU-safe)
    particles[index].vel = vec2<f32>(
      sin(f32(index)) * 0.01,
      cos(f32(index * 17.0)) * 0.01
    );
  }
}

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
