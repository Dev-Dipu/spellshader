// Effect 4: JELLY — Translucent volumetric jelly bodies in a glass container
// Inspired by spite/spellshader-2026 #9

export const jellyVertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uSoftness;    // how squished/deformed
  uniform float uWobble;      // animation wobble

  varying vec3 vWorldPos;
  varying vec3 vNormal;
  varying vec3 vLocalPos;
  varying float vDepth;

  void main() {
    vec3 pos = position;

    // Soft body squish simulation: bodies compress on y, expand on xz
    float squishY = 1.0 - uSoftness * 0.2 * sin(uTime * 2.0 + position.y * 3.0);
    float squishXZ = 1.0 + uSoftness * 0.1 * sin(uTime * 2.0 + position.y * 3.0);
    pos.y *= squishY;
    pos.x *= squishXZ;
    pos.z *= squishXZ;

    // Wobble jiggle
    pos += normal * sin(uTime * 4.0 + length(position) * 5.0) * uWobble * 0.015;

    vLocalPos = pos;
    vNormal = normalize(normalMatrix * normal);
    vWorldPos = (modelMatrix * vec4(pos, 1.0)).xyz;
    vDepth = abs(dot(normalize(pos), normal)); // surface depth indicator

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

export const jellyFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform vec3 uJellyColor;    // primary jelly hue
  uniform float uDensity;      // color depth / absorption
  uniform float uMilk;         // milkiness / subsurface scattering
  uniform float uFrost;        // surface frost/blur
  uniform float uRefraction;   // refraction amount
  uniform vec3 uLightDir;
  uniform vec3 uLightColor;
  uniform float uRoughness;
  uniform float uGlow;         // emission glow strength

  varying vec3 vWorldPos;
  varying vec3 vNormal;
  varying vec3 vLocalPos;
  varying float vDepth;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f*f*(3.0-2.0*f);
    return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
  }

  void main() {
    vec3 N = normalize(vNormal);
    vec3 L = normalize(uLightDir);
    vec3 V = normalize(cameraPosition - vWorldPos);
    vec3 H = normalize(L + V);

    float NdotL = max(dot(N, L), 0.0);
    float NdotV = max(dot(N, V), 0.0);

    // Fresnel: glassy rim
    float fresnel = pow(1.0 - NdotV, 3.0);

    // Beer-Lambert absorption: colour deepens with thickness
    float thickness = mix(0.1, 2.0, 1.0 - vDepth) * uDensity;
    vec3 absorption = exp(-vec3(1.0) * thickness * max(vec3(0.0), vec3(1.0) - uJellyColor));

    // Milk: adds scattering (brightens and tints)
    vec3 milkColor = uJellyColor * uMilk * 0.4;

    // Frost on surface: texture noise for satin look
    float frostN = noise(vWorldPos.xy * 8.0 + vWorldPos.z * 3.0) * uFrost;
    vec3 frostNorm = N + vec3(frostN * 0.3 - 0.15, frostN * 0.3 - 0.15, 0.0);
    frostNorm = normalize(frostNorm);

    // Specular: sharp highlight through the frost
    float specPow = mix(256.0, 16.0, uRoughness + frostN * 0.5);
    float spec = pow(max(dot(frostNorm, H), 0.0), specPow);

    // Diffuse light + subsurface scatter
    float diff = NdotL * 0.7 + 0.3; // wrapped lighting for translucency
    float backScatter = max(dot(-N, L), 0.0) * uMilk * 0.4;

    // Compose
    vec3 baseColor = uJellyColor * absorption;
    vec3 color = baseColor * diff * uLightColor + milkColor * uLightColor * 0.5;
    color += uLightColor * spec * mix(vec3(1.0), uJellyColor, 0.4);
    color += uJellyColor * backScatter * uLightColor;
    // Fresnel adds reflective rim
    color = mix(color, mix(vec3(1.0), uJellyColor * 1.5, 0.5) * uLightColor, fresnel * 0.5);

    // Subsurface glow (candy-like emission)
    vec3 glow = uJellyColor * uGlow * (uMilk * 0.3 + 0.1) * (0.5 + 0.5 * sin(uTime + vWorldPos.y));
    color += glow;

    // Transparency: more see-through toward edges
    float alpha = mix(0.65, 0.95, NdotV) + fresnel * 0.1;
    alpha = clamp(alpha + uMilk * 0.1, 0.0, 1.0);

    gl_FragColor = vec4(color, alpha);
  }
`;

// Glass container shader (transparent outer shell)
export const containerVertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uWallThickness;

  varying vec3 vWorldPos;
  varying vec3 vNormal;
  varying vec3 vReflect;

  void main() {
    vNormal = normalize(normalMatrix * normal);
    vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;

    // Reflection vector
    vec3 V = normalize(cameraPosition - vWorldPos);
    vReflect = reflect(-V, vNormal);

    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const containerFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform vec3 uContainerColor;    // tint
  uniform float uContainerHaze;   // opacity/cloudiness
  uniform float uWallThickness;
  uniform float uFrost;
  uniform vec3 uLightDir;
  uniform float uDispersion;

  varying vec3 vWorldPos;
  varying vec3 vNormal;
  varying vec3 vReflect;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f=f*f*(3.0-2.0*f);
    return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
  }

  void main() {
    vec3 N = normalize(vNormal);
    vec3 V = normalize(cameraPosition - vWorldPos);
    vec3 L = normalize(uLightDir);

    float NdotV = max(dot(N, V), 0.0);
    float fresnel = pow(1.0 - NdotV, 3.0);

    // Glass-like surface
    float spec = pow(max(dot(reflect(-L, N), V), 0.0), 128.0);

    // Frost noise for satin glass
    float frostN = noise(vWorldPos.xy * 6.0 + vWorldPos.z * 4.0) * uFrost;

    // Haze: how much of the glass colour shows
    vec3 glassColor = mix(vec3(1.0), uContainerColor, uContainerHaze * 0.6);

    // Thin glass rim gets a bright edge
    vec3 rimColor = mix(vec3(1.0), uContainerColor, 0.3) * fresnel * (1.0 + uWallThickness * 5.0);

    vec3 color = glassColor + rimColor;
    color += vec3(1.0) * spec;
    color += frostN * 0.1 * uContainerColor;

    // Dispersion: subtle rainbow at edges
    if (uDispersion > 0.0) {
      float r = pow(1.0 - max(dot(N - vec3(0.01, 0.0, 0.0), V), 0.0), 3.0);
      float b = pow(1.0 - max(dot(N + vec3(0.01, 0.0, 0.0), V), 0.0), 3.0);
      color.r += (r - fresnel) * uDispersion;
      color.b += (b - fresnel) * uDispersion;
    }

    float alpha = mix(uWallThickness * 2.0 + uContainerHaze * 0.2 + 0.08, 0.7, fresnel);
    alpha = clamp(alpha, 0.04, 0.72);

    gl_FragColor = vec4(color, alpha);
  }
`;
