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

struct Disrupt {
  isActive: f32,
};

struct Seed {
  value: f32,
};

@group(0) @binding(0) var<storage, read_write> particles : array<Particle>;
@group(0) @binding(1) var<uniform> attractors: array<Attractor, 2>;
@group(0) @binding(2) var<uniform> disrupt: Disrupt;
@group(0) @binding(3) var<uniform> seed: Seed;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id : vec3<u32>) {
  let index = id.x;
  if (index >= arrayLength(&particles)) {
    return;
  }

  var totalForce = vec2<f32>(0.0, 0.0);
  for (var i = 0u; i < 2u; i = i + 1u) {
    if (attractors[i].enabled == 1u) {
      let toAttractor = attractors[i].pos - particles[index].pos;
      let dist = length(toAttractor) + 0.0001;

      // --- Ring parameters ---
      let desiredRadius = 0.01 + 0.10 * random(f32(index) * 10.0 + f32(i) * 100.0);
      let springK = 0.15;
      let baseTangentialSpeed = 0.025;

      let radialDir = normalize(toAttractor);
      let radialError = dist - desiredRadius;
      let radialForce = radialDir * radialError * springK * attractors[i].strength;

      let tangent = vec2<f32>(-radialDir.y, radialDir.x);
      let tangentialSpeed = (baseTangentialSpeed + 0.04 * exp(-abs(radialError) * 10.0)) * desiredRadius / 0.3;
      let tangentialForce = tangent * tangentialSpeed;

      let noiseAmount = 0.008 * clamp(desiredRadius / 0.3, 0.2, 1.0);
      let noise = vec2<f32>(
        random(f32(index) * 1.23 + dist * 100.0 + f32(i) * 50.0) - 0.5,
        random(f32(index) * 4.56 + dist * 200.0 + f32(i) * 50.0) - 0.5
      ) * noiseAmount;

      totalForce += radialForce + noise;
      totalForce = tangentialForce + totalForce * 0.97;
    }
  }

  // Optional: limit max speed for stability
  let maxSpeed = 0.07;
  let speed = length(totalForce);
  if (speed > maxSpeed) {
    totalForce = normalize(totalForce) * maxSpeed;
  }

  particles[index].vel += totalForce;

 if (disrupt.isActive > 0.5) {

    let t = seed.value;
    // Use a more unique seed for each particle
    let base = f32(index) * 13.37 + t * 0.123;
    let kickMag = 0.15 + random(base) * 0.25;
    let angle = random(base + 100.0) * 6.2831853;
    let kick = vec2<f32>(cos(angle), sin(angle)) * kickMag;
    particles[index].vel += kick;
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