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
  let toAttractor = attractor.pos - particles[index].pos;
  let dist = length(toAttractor) + 0.001;
  let pull = normalize(toAttractor) / (dist * dist);

  // Create tangential (vortex) force — 90 degree rotation of direction
  let tangent = vec2<f32>(-toAttractor.y, toAttractor.x);
  let swirl = normalize(tangent) / dist;

  // Combine pull + swirl
  let vortexForce = pull * attractor.strength + swirl * attractor.strength * 0.5;
  particles[index].vel += vortexForce;

  if (dist < 0.01) {
     // Deflection outward
     let escape = normalize(toAttractor) * -0.05;
     particles[index].vel += escape;

    // Swirl kick
    // particles[index].vel += swirl * 0.01;
     particles[index].vel *= 0.98; // Damping
     
    // limit max speed
    let maxSpeed = 0.05;
    let speed = length(particles[index].vel);
    if (speed > maxSpeed) {
    particles[index].vel = normalize(particles[index].vel) * maxSpeed;
}
     particles[index].vel += normalize(toAttractor) * 0.0005;

  }

  if (length(particles[index].vel) < 0.001) {
  particles[index].vel = vec2<f32>(
    sin(f32(index)) * 0.005,
    cos(f32(index) * 11.0) * 0.005
  );
}

}

  // Update position
  particles[index].pos += particles[index].vel;

  // Soft bounce at edges
if (particles[index].pos.x > 1.0) {
    particles[index].pos.x = 1.0;
    particles[index].vel.x *= -0.7; // lose some energy
}
if (particles[index].pos.x < -1.0) {
    particles[index].pos.x = -1.0;
    particles[index].vel.x *= -0.7;
}
if (particles[index].pos.y > 1.0) {
    particles[index].pos.y = 1.0;
    particles[index].vel.y *= -0.7;
}
if (particles[index].pos.y < -1.0) {
    particles[index].pos.y = -1.0;
    particles[index].vel.y *= -0.7;
}
}
