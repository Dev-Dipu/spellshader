// Effect 1: MELT — Candy/Lacquer liquid coating melting off a shape
// Inspired by spite/spellshader-2026 #3

export const meltVertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uMeltAmount;
  uniform float uDripSpeed;
  uniform float uDripLength;
  uniform vec3 uColor1;
  uniform vec3 uColor2;

  varying vec3 vWorldPos;
  varying vec3 vNormal;
  varying float vMelt;
  varying float vDrip;
  varying vec2 vUv;

  // Smooth noise
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1,0)), f.x),
               mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x), f.y);
  }

  void main() {
    vec3 pos = position;
    vNormal = normalize(normalMatrix * normal);
    vUv = uv;

    // World-space Y used for drip simulation
    vec4 worldPos4 = modelMatrix * vec4(position, 1.0);
    vWorldPos = worldPos4.xyz;

    // Drip: surface noise drives outward blobs flowing downward
    float n = noise(vec2(pos.x * 2.5 + uTime * 0.3, pos.z * 2.5));
    float n2 = noise(vec2(pos.x * 5.0, pos.z * 5.0 + uTime * uDripSpeed));
    float drip = pow(max(0.0, n2 - 0.4) * 1.6, 2.0) * uMeltAmount;
    drip *= (1.0 - smoothstep(-1.5, 0.5, pos.y)); // drips on lower half

    // Outward melt + downward pull
    vec3 meltDir = normalize(vec3(normal.x * 0.6, -1.0, normal.z * 0.6));
    pos += meltDir * drip * uDripLength;

    vMelt = drip;
    vDrip = n;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

export const meltFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uMeltAmount;
  uniform vec3 uColor1;
  uniform vec3 uColor2;
  uniform vec3 uLightDir;
  uniform float uFinish; // 0=lacquer, 1=candy, 2=mercury, 3=wax
  uniform float uSpecular;
  uniform float uRoughness;

  varying vec3 vWorldPos;
  varying vec3 vNormal;
  varying float vMelt;
  varying float vDrip;
  varying vec2 vUv;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y);
  }

  // GGX specular for a glossy coating
  float GGX(vec3 N, vec3 H, float roughness) {
    float a = roughness * roughness;
    float a2 = a * a;
    float NdotH = max(dot(N, H), 0.0);
    float denom = NdotH * NdotH * (a2 - 1.0) + 1.0;
    return a2 / (3.14159 * denom * denom + 0.0001);
  }

  void main() {
    vec3 N = normalize(vNormal);
    vec3 L = normalize(uLightDir);
    vec3 V = normalize(cameraPosition - vWorldPos);
    vec3 H = normalize(L + V);

    // Flow color: mix between base and drip color
    float flowFactor = smoothstep(0.0, 1.0, vMelt * 2.0);
    vec3 baseColor = mix(uColor1, uColor2, flowFactor);

    // Candy: subsurface scattering look - bright rim + translucent depth
    float rim = pow(1.0 - max(dot(N, V), 0.0), 3.0);
    float diff = max(dot(N, L), 0.0);

    // Finish-based shading
    float roughness = uRoughness;
    vec3 specColor = vec3(1.0);
    float specularStrength = uSpecular;

    if (uFinish < 0.5) {
      // Lacquer: very glossy, slight tint
      roughness = 0.05;
      specColor = mix(vec3(1.0), baseColor, 0.3);
    } else if (uFinish < 1.5) {
      // Candy: coloured specular, strong rim
      roughness = 0.08;
      specColor = mix(vec3(1.0), baseColor * 1.5, 0.5);
      specularStrength *= (1.0 + rim * 2.0);
    } else if (uFinish < 2.5) {
      // Mercury: metallic, low diffuse
      roughness = 0.02;
      specColor = vec3(0.9);
      baseColor = mix(baseColor * 0.3, vec3(0.85), 0.5);
    } else {
      // Wax: very rough, subsurface glow
      roughness = 0.6;
      specColor = vec3(1.0, 0.95, 0.85);
      baseColor = mix(baseColor, baseColor * 1.4, rim * 0.5);
    }

    float spec = GGX(N, H, roughness) * specularStrength;
    float ambient = 0.15;
    vec3 color = baseColor * (diff * 0.8 + ambient) + specColor * spec;

    // Candy gets a rim glow
    if (uFinish > 0.5 && uFinish < 1.5) {
      color += baseColor * rim * 0.4 * uMeltAmount;
    }

    // Drip surface variation
    float dripSheen = smoothstep(0.3, 0.8, vDrip) * vMelt;
    color += specColor * dripSheen * 0.5;

    gl_FragColor = vec4(color, 1.0);
  }
`;
