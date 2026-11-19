// Effect 3: BURST — Cracking/exploding shell with flying debris
// Inspired by spite/spellshader-2026 #2

export const burstVertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uExplosion; // 0=intact, 1=fully exploded
  uniform float uSpray;

  // Per-piece data (for shell pieces)
  attribute vec3 aPieceCenter;    // piece centre of mass
  attribute vec3 aPieceVelocity;  // throw velocity
  attribute vec3 aPieceAxis;      // spin axis
  attribute float aPieceSpin;     // spin speed

  varying vec3 vWorldPos;
  varying vec3 vNormal;
  varying vec3 vColor;
  varying float vIsShell;

  void main() {
    // Fly the piece outward
    float t = uExplosion * 0.6;
    vec3 offset = aPieceVelocity * t;

    // Spin around piece axis
    float angle = aPieceSpin * t;
    float c = cos(angle), s = sin(angle);
    vec3 axis = normalize(aPieceAxis + vec3(0.001));
    // Rodrigues rotation
    vec3 localPos = position - aPieceCenter;
    vec3 rotated = localPos * c + cross(axis, localPos) * s + axis * dot(axis, localPos) * (1.0 - c);
    vec3 finalPos = aPieceCenter + rotated + offset;

    vNormal = normalize(normalMatrix * normal);
    vWorldPos = (modelMatrix * vec4(finalPos, 1.0)).xyz;
    vIsShell = 1.0;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(finalPos, 1.0);
  }
`;

export const burstFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uExplosion;
  uniform vec3 uShellColor;
  uniform vec3 uFillColor;
  uniform vec3 uLightDir;
  uniform float uSubject; // 0=chocolate, 1=watermelon, 2=citrus, 3=geode
  uniform float uRoughness;
  uniform float uSpecular;

  varying vec3 vWorldPos;
  varying vec3 vNormal;
  varying float vIsShell;

  float hash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
  float noise(vec3 p) {
    vec3 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float n000 = hash(i);
    float n100 = hash(i + vec3(1,0,0));
    float n010 = hash(i + vec3(0,1,0));
    float n110 = hash(i + vec3(1,1,0));
    float n001 = hash(i + vec3(0,0,1));
    float n101 = hash(i + vec3(1,0,1));
    float n011 = hash(i + vec3(0,1,1));
    float n111 = hash(i + vec3(1,1,1));
    return mix(mix(mix(n000,n100,f.x),mix(n010,n110,f.x),f.y),
               mix(mix(n001,n101,f.x),mix(n011,n111,f.x),f.y), f.z);
  }

  void main() {
    vec3 N = normalize(vNormal);
    vec3 L = normalize(uLightDir);
    vec3 V = normalize(cameraPosition - vWorldPos);
    vec3 H = normalize(L + V);

    vec3 shellCol = uShellColor;
    vec3 fillCol = uFillColor;
    float rough = uRoughness;

    // Subject-specific surface detail
    vec3 baseColor;
    if (uSubject < 0.5) {
      // Chocolate: dark shell with lighter fill interior
      float grain = noise(vWorldPos * 8.0) * 0.08;
      shellCol = mix(vec3(0.22, 0.12, 0.05), vec3(0.4, 0.22, 0.1), grain);
      fillCol = vec3(0.55, 0.3, 0.12);
      rough = 0.6;
    } else if (uSubject < 1.5) {
      // Watermelon: green shell, red-pink fill with seeds
      float stripes = step(0.5, fract(vWorldPos.y * 2.5 + 0.2));
      shellCol = mix(vec3(0.2, 0.55, 0.15), vec3(0.1, 0.35, 0.08), stripes);
      fillCol = vec3(0.85, 0.2, 0.25);
      rough = 0.75;
    } else if (uSubject < 2.5) {
      // Citrus: orange/yellow shell, juicy segments
      float cell = noise(vWorldPos * 4.0 + 1.3);
      shellCol = mix(vec3(0.9, 0.5, 0.1), vec3(0.95, 0.7, 0.2), cell);
      fillCol = mix(vec3(0.9, 0.6, 0.15), vec3(0.98, 0.78, 0.4), cell * 0.7);
      rough = 0.65;
    } else {
      // Geode: dark outer rock, crystal-glittery inside
      float crystal = pow(noise(vWorldPos * 12.0), 2.0);
      shellCol = mix(vec3(0.25, 0.22, 0.2), vec3(0.4, 0.38, 0.35), crystal * 0.5);
      fillCol = mix(vec3(0.5, 0.3, 0.7), vec3(0.8, 0.6, 0.95), crystal);
      rough = mix(0.6, 0.02, crystal);
    }

    // The shell is the outer layer, fill is inner
    baseColor = shellCol;

    float diff = max(dot(N, L), 0.0);
    float specPow = mix(8.0, 512.0, 1.0 - rough);
    float spec = pow(max(dot(N, H), 0.0), specPow) * uSpecular;
    float ambient = 0.18;

    vec3 specColor = mix(vec3(1.0), baseColor, rough);
    vec3 color = baseColor * (diff * (1.0 - ambient) + ambient) + specColor * spec;

    // Edge fresnel highlight
    float fresnel = pow(1.0 - max(dot(N, V), 0.0), 3.0);
    color += specColor * fresnel * 0.3;

    gl_FragColor = vec4(color, 1.0);
  }
`;

// Drop/spray particle shader
export const dropVertexShader = /* glsl */ `
  attribute vec3 aVelocity;
  attribute float aSize;
  attribute float aPhase;

  uniform float uExplosion;
  uniform float uSpray;

  varying float vAlpha;
  varying vec3 vColor;

  void main() {
    float t = uExplosion * 0.6;
    vec3 pos = position + aVelocity * t;

    // Gravity
    pos.y -= 2.0 * t * t;

    float life = 1.0 - smoothstep(0.0, 0.8, t);
    vAlpha = life * uSpray;

    vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPos;
    gl_PointSize = aSize * 180.0 / -mvPos.z;
  }
`;

export const dropFragmentShader = /* glsl */ `
  uniform vec3 uDropColor;
  varying float vAlpha;

  void main() {
    vec2 uv = gl_PointCoord * 2.0 - 1.0;
    float r = dot(uv, uv);
    if (r > 1.0) discard;
    float alpha = (1.0 - r) * vAlpha;
    gl_FragColor = vec4(uDropColor, alpha);
  }
`;
