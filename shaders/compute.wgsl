fn random(seed: f32) -> f32 {
  return fract(sin(seed) * 43758.5453123);
}

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

  if (attractor.enabled == 1u) {
    let toAttractor = attractor.pos - particles[index].pos;
    let dist = length(toAttractor) + 0.0001;

    // --- Ring parameters ---
    let desiredRadius = 0.01 + 0.10 * random(f32(index) * 10.0);
let springK = 0.15;
let baseTangentialSpeed = 0.025;

let radialDir = normalize(toAttractor);
let radialError = dist - desiredRadius;
let radialForce = radialDir * radialError * springK;

let tangent = vec2<f32>(-radialDir.y, radialDir.x);
// Tangential speed scales with desiredRadius
let tangentialSpeed = (baseTangentialSpeed + 0.04 * exp(-abs(radialError) * 10.0)) * desiredRadius / 0.3;
let tangentialForce = tangent * tangentialSpeed;

// Noise scales with radius (less near center)
let noiseAmount = 0.008 * clamp(desiredRadius / 0.3, 0.2, 1.0);
let noise = vec2<f32>(
  random(f32(index) * 1.23 + dist * 100.0) - 0.5,
  random(f32(index) * 4.56 + dist * 200.0) - 0.5
) * noiseAmount;

particles[index].vel += radialForce + noise;
particles[index].vel = tangentialForce + particles[index].vel * 0.97;

    // Optional: limit max speed for stability
    let maxSpeed = 0.07;
    let speed = length(particles[index].vel);
    if (speed > maxSpeed) {
      particles[index].vel = normalize(particles[index].vel) * maxSpeed;
    }
  }

  // Update position
  particles[index].pos += particles[index].vel;

  // Soft bounce at edges
  if (particles[index].pos.x > 1.0) {
    particles[index].pos.x = 1.0;
    particles[index].vel.x *= -0.7;
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
