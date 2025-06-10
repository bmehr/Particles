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

struct AttractorRadius {
  value: f32,
};

@group(0) @binding(0) var<storage, read_write> particles : array<Particle>;
@group(0) @binding(1) var<uniform> attractors: array<Attractor, 2>;
@group(0) @binding(2) var<uniform> disrupt: Disrupt;
@group(0) @binding(3) var<uniform> seed: Seed;
@group(0) @binding(5) var<uniform> attractorRadius: AttractorRadius;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id : vec3<u32>) {
  let index = id.x;
  if (index >= arrayLength(&particles)) {
    return;
  }

  var totalForce = vec2<f32>(0.0, 0.0);

  // --- Find nearest attractor ---
  var nearestIdx: u32 = 0u;
  var nearestDist: f32 = 1e6;
  for (var i = 0u; i < 2u; i = i + 1u) {
    if (attractors[i].enabled == 1u) {
      let toAttractor = attractors[i].pos - particles[index].pos;
      let dist = length(toAttractor);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestIdx = i;
      }
    }
  }

  // --- Gentle global pull from all attractors ---
  for (var i = 0u; i < 2u; i = i + 1u) {
    if (attractors[i].enabled == 1u) {
      let toA = attractors[i].pos - particles[index].pos;
      totalForce += normalize(toA) * 0.05 * attractors[i].strength;
    }
  }

  // --- Strong spinning/orbiting force from nearest attractor only ---
  let nearestAttractor = attractors[nearestIdx];
  let toNearest = nearestAttractor.pos - particles[index].pos;
  let dist = length(toNearest) + 0.0001;
  let influenceRadius = attractorRadius.value;

  if (dist < influenceRadius) {
    let influence = 1.0 - (dist / influenceRadius);

    // Tangential (spinning) force, proportional to dist*dist for stable orbits
    let tangent = vec2<f32>(-toNearest.y, toNearest.x) / dist;
    let tangentialSpeed = 2.0 * dist * dist * nearestAttractor.strength;
    let tangentialForce = tangent * tangentialSpeed;

    // Gentle centripetal force to keep orbits tight
    let centripetalForce = -normalize(toNearest) * 0.03 * influence * nearestAttractor.strength;

    // Minimal noise for smooth orbits
    let noise = vec2<f32>(
      random(f32(index) * 1.23 + dist * 100.0 + f32(nearestIdx) * 50.0) - 0.5,
      random(f32(index) * 4.56 + dist * 200.0 + f32(nearestIdx) * 50.0) - 0.5
    ) * 0.0001 * influence;

    totalForce += tangentialForce + centripetalForce + noise;
  }

  // Higher max speed for more dramatic orbits
  let maxSpeed = 0.28;
  let speed = length(totalForce);
  if (speed > maxSpeed) {
    totalForce = normalize(totalForce) * maxSpeed;
  }

  particles[index].vel += totalForce;

  // Disrupt "kick" logic (unchanged)
  if (disrupt.isActive > 0.5) {

    let t = seed.value;

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