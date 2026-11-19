// Effect 2: FEATHERS — Procedural feather coat on a shape
// Inspired by spite/spellshader-2026 #12

export const featherVertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uFeatherLength;
  uniform float uFeatherWidth;
  uniform float uCurl;
  uniform float uRuffle;
  uniform float uSpin;
  uniform float uDensity;

  attribute vec3 aFeatherDir;   // base direction of feather from surface
  attribute vec3 aNormal;       // surface normal at feather root
  attribute float aFeatherPhase;// individual feather phase for variation
  attribute float aFeatherScale;// size variation per feather

  varying vec3 vWorldPos;
  varying vec3 vBarb;
  varying float vT;             // 0=root, 1=tip along quill
  varying vec3 vNormal;
  varying vec3 vTangent;
  varying float vWidth;

  void main() {
    // Billboard feather: position.y goes 0->1 along the quill, x is barb width
    float t = position.y; // 0=root, 1=tip
    float xOff = position.x; // -1 to 1 for barb width

    vT = t;

    // Ruffle and curl animations
    float ruffleWave = sin(uTime * 2.5 + aFeatherPhase * 6.28) * uRuffle * (1.0 - t);
    float windCurl = sin(uTime * 1.3 + aFeatherPhase * 3.14 + t * 2.0) * 0.08;

    // Feather shape: taper toward tip, narrow at root
    float widthProfile = smoothstep(0.0, 0.08, t) * (1.0 - t * t * 0.6) * aFeatherScale;
    vWidth = widthProfile;

    // Build feather coordinate frame
    vec3 N = normalize(aNormal);
    vec3 D = normalize(aFeatherDir);
    vec3 side = normalize(cross(D, N + vec3(0.001)));

    // Curl: feather bends toward tip
    float curlAmount = uCurl * t * t * 0.4;
    vec3 curlDir = mix(D, N, curlAmount);
    curlDir = normalize(curlDir);

    // Position along quill + ruffled barbs
    vec3 quillPos = aFeatherDir + D * t * uFeatherLength * aFeatherScale;
    // Curl inward
    quillPos += N * curlAmount * uFeatherLength * 0.5 * aFeatherScale;
    // Ruffle
    quillPos += side * ruffleWave * 0.1;
    quillPos += N * windCurl * 0.05;

    // Barb offset perpendicular to quill
    vec3 barbDir = normalize(cross(D + N * 0.3, N));
    vec3 finalPos = quillPos + barbDir * xOff * widthProfile * uFeatherWidth;

    vWorldPos = (modelMatrix * vec4(finalPos, 1.0)).xyz;
    vBarb = barbDir;
    vNormal = normalize(normalMatrix * N);
    vTangent = normalize(normalMatrix * D);

    gl_Position = projectionMatrix * modelViewMatrix * vec4(finalPos, 1.0);
  }
`;

export const featherFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform vec3 uColorDown;    // downy base
  uniform vec3 uColorBody;    // main body color
  uniform vec3 uColorMark;    // dark markings
  uniform vec3 uColorAccent;  // accent/highlight
  uniform float uPattern;     // 0=plain,1=gradient,2=barred,3=streaked,4=mottled
  uniform float uPatternAmt;
  uniform vec3 uLightDir;
  uniform float uSeeThrough;
  uniform float uInternalShadow;
  uniform float uLook;        // 0=light, 1=dark

  varying vec3 vWorldPos;
  varying vec3 vBarb;
  varying float vT;
  varying vec3 vNormal;
  varying vec3 vTangent;
  varying float vWidth;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y);
  }

  void main() {
    // Feather silhouette: alpha fades at barb edges
    float barbEdge = 1.0 - abs(vT * 2.0 - 1.0) * 0.5;
    float alpha = smoothstep(0.0, 0.1, vWidth) * (uSeeThrough > 0.5 ? 0.92 : 1.0);
    if (alpha < 0.05) discard;

    // Pattern along quill (vT) and position in world
    vec2 pCoord = vec2(vT * 8.0, vWorldPos.y * 2.0 + vWorldPos.x);

    vec3 baseColor = uColorBody;

    // Plain: uniform color
    if (uPattern < 0.5) {
      baseColor = mix(uColorDown, uColorBody, vT);
    }
    // Gradient: tip to root gradient
    else if (uPattern < 1.5) {
      baseColor = mix(uColorDown, mix(uColorBody, uColorAccent, vT), vT * vT);
    }
    // Barred: horizontal bands of dark markings
    else if (uPattern < 2.5) {
      float bar = step(0.4, fract(vT * 4.0 * uPatternAmt + 0.1));
      baseColor = mix(uColorBody, uColorMark, bar * uPatternAmt);
    }
    // Streaked: longitudinal streaks
    else if (uPattern < 3.5) {
      float streak = noise(vec2(vWorldPos.x * 8.0 + vWorldPos.z * 3.0, vT));
      streak = step(0.65, streak);
      baseColor = mix(uColorBody, uColorMark, streak * uPatternAmt);
    }
    // Mottled: random blotches
    else {
      float mott = noise(vec2(vWorldPos.x * 5.0 + vT * 3.0, vWorldPos.z * 5.0));
      mott = smoothstep(0.4, 0.7, mott);
      float streakN = noise(vec2(vWorldPos.x * 7.0, vT * 6.0));
      streakN = step(0.6, streakN);
      baseColor = mix(uColorBody, mix(uColorMark, uColorAccent, 0.3), (mott + streakN) * 0.5 * uPatternAmt);
    }

    // Lighting
    vec3 N = normalize(vNormal);
    vec3 L = normalize(uLightDir);
    vec3 V = normalize(cameraPosition - vWorldPos);

    float diff = max(dot(N, L), 0.0);
    float backLight = max(dot(-N, L), 0.0) * 0.3; // translucent backlit

    // Internal shadow: feathers deeper inside are darker
    float internalOcc = mix(1.0, 0.4, uInternalShadow * (1.0 - vT));

    float ambientStr = uLook < 0.5 ? 0.5 : 0.08;
    vec3 color = baseColor * (diff * (1.0 - ambientStr) + ambientStr + backLight) * internalOcc;

    // Specular sheen on barbs
    vec3 H = normalize(L + V);
    float spec = pow(max(dot(N, H), 0.0), 32.0) * 0.4;
    color += mix(vec3(1.0), baseColor, 0.4) * spec;

    // Downy base at root
    color = mix(uColorDown * (diff * 0.6 + ambientStr), color, smoothstep(0.0, 0.25, vT));

    // Dark look adjustment
    if (uLook > 0.5) {
      color *= 1.3;
    }

    gl_FragColor = vec4(color, alpha);
  }
`;
