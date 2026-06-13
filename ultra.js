/**
 * MO THE LAWN — ULTRA mode v2
 * Cinematic Three.js renderer: instanced 3D grass with wind, PBR mower,
 * procedural sky/IBL, ACES + bloom/tilt-shift post-processing.
 * Lazy-loaded by index.html; shares mow state through the bridge.
 */
import * as THREE from 'three';
import {
    EffectComposer, RenderPass, EffectPass,
    BloomEffect, VignetteEffect, NoiseEffect,
    ToneMappingEffect, ToneMappingMode,
    SMAAEffect, BlendFunction
} from 'postprocessing';
import { CSS3DRenderer, CSS3DObject } from './vendor/CSS3DRenderer.js';

export function initUltra(bridge) {
    const st = bridge.state();
    const COLS = st.cols, ROWS = st.rows;
    const W = COLS, H = ROWS; // 1 tile = 1 world unit
    const isMobile = matchMedia('(pointer: coarse)').matches || innerWidth < 800;
    const DPR = Math.min(devicePixelRatio || 1, isMobile ? 1.5 : 2);
    const BLADES = isMobile ? 80000 : 230000;

    /* ---------- palettes ---------- */
    const PALS = {
        day: {
            skyTop: 0x6fa8dc, skyBot: 0xdfeee0, sunDir: [0.45, 0.7, 0.35],
            sunCol: 0xfff1d6, sunInt: 3.0, hemiSky: 0xbcd8f0, hemiGnd: 0x3c5a2e, hemiInt: 0.55,
            base: 0x1e5a1d, tip: 0x7fb24a, stubble: [0.95, 0.92, 0.55],
            fog: 0xcfe3cf, fogD: 0.0035, groundTint: 0xffffff, envSun: 18
        },
        dusk: {
            skyTop: 0x53466e, skyBot: 0xf0a05a, sunDir: [0.85, 0.22, 0.25],
            sunCol: 0xffac63, sunInt: 2.6, hemiSky: 0xb08bb0, hemiGnd: 0x4a3c20, hemiInt: 0.4,
            base: 0x3d4a16, tip: 0xb0a04a, stubble: [1.0, 0.85, 0.5],
            fog: 0xc89070, fogD: 0.005, groundTint: 0xddb890, envSun: 14
        },
        night: {
            skyTop: 0x101c3a, skyBot: 0x32466b, sunDir: [0.3, 0.65, 0.4],
            sunCol: 0xb8d0f5, sunInt: 1.6, hemiSky: 0x44598a, hemiGnd: 0x1a2c20, hemiInt: 0.65,
            base: 0x16321f, tip: 0x49805d, stubble: [0.55, 0.68, 0.55],
            fog: 0x1a2840, fogD: 0.004, groundTint: 0x93a6c8, envSun: 6
        }
    };
    let pal = PALS[st.mode] || PALS.day;

    /* ---------- renderer ---------- */
    const canvas = document.createElement('canvas');
    canvas.id = 'gl3d';
    canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:5;display:block;';
    document.body.appendChild(canvas);

    const renderer = new THREE.WebGLRenderer({
        canvas, antialias: isMobile, powerPreference: 'high-performance'
    });
    renderer.setPixelRatio(DPR);
    renderer.setSize(innerWidth, innerHeight);
    renderer.toneMapping = THREE.NoToneMapping; // tonemapped in post
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(pal.fog, pal.fogD);

    /* ---------- camera (fixed steep oblique; the whole screen is lawn) ---------- */
    const camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.5, 600);
    const ELEV = THREE.MathUtils.degToRad(50);
    const CAM_H = 24;
    let pushIn = 0; // LEVEL CLEAR camera push

    function placeCamera() {
        const k = 1 - 0.10 * pushIn;
        camera.position.set(0, CAM_H * k, (CAM_H / Math.tan(ELEV)) * k);
        camera.lookAt(0, 0, 0);
        camera.updateMatrixWorld();
    }
    placeCamera();

    /* ---------- sky dome ---------- */
    const skyUni = {
        top: { value: new THREE.Color(pal.skyTop) },
        bot: { value: new THREE.Color(pal.skyBot) }
    };
    const sky = new THREE.Mesh(
        new THREE.SphereGeometry(480, 24, 16),
        new THREE.ShaderMaterial({
            side: THREE.BackSide, depthWrite: false, fog: false,
            uniforms: skyUni,
            vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
            fragmentShader: 'uniform vec3 top, bot; varying vec3 vP; void main(){ float h = clamp(normalize(vP).y * 1.6 + 0.18, 0.0, 1.0); gl_FragColor = vec4(mix(bot, top, pow(h, 0.75)), 1.0); }'
        })
    );
    scene.add(sky);

    /* ---------- lights ---------- */
    const sun = new THREE.DirectionalLight(pal.sunCol, pal.sunInt);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    const SB = Math.max(W, H) * 0.65;
    Object.assign(sun.shadow.camera, { left: -SB, right: SB, top: SB, bottom: -SB, near: 1, far: 200 });
    sun.shadow.bias = -0.002;
    scene.add(sun, sun.target);
    const hemi = new THREE.HemisphereLight(pal.hemiSky, pal.hemiGnd, pal.hemiInt);
    scene.add(hemi);

    function applySunDir() {
        const d = pal.sunDir;
        sun.position.set(d[0] * 80, d[1] * 80, d[2] * 80);
        sun.target.position.set(0, 0, 0);
    }
    applySunDir();

    /* ---------- environment (procedural IBL for the mower's PBR) ---------- */
    function buildEnvScene(modeName) {
        const p = PALS[modeName];
        const es = new THREE.Scene();
        es.add(new THREE.Mesh(
            new THREE.SphereGeometry(60, 16, 12),
            new THREE.ShaderMaterial({
                side: THREE.BackSide,
                uniforms: { top: { value: new THREE.Color(p.skyTop) }, bot: { value: new THREE.Color(p.skyBot) } },
                vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
                fragmentShader: 'uniform vec3 top, bot; varying vec3 vP; void main(){ float h = clamp(normalize(vP).y * 1.4 + 0.25, 0.0, 1.0); gl_FragColor = vec4(mix(bot, top, h), 1.0); }'
            })
        ));
        const sunBall = new THREE.Mesh(
            new THREE.SphereGeometry(4, 12, 8),
            new THREE.MeshBasicMaterial({ color: new THREE.Color(p.sunCol).multiplyScalar(p.envSun) })
        );
        sunBall.position.set(p.sunDir[0] * 45, p.sunDir[1] * 45, p.sunDir[2] * 45);
        es.add(sunBall);
        return es;
    }
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envCache = {};
    function buildEnv(modeName) {
        if (envCache[modeName]) return envCache[modeName];
        envCache[modeName] = pmrem.fromScene(buildEnvScene(modeName), 0.05).texture;
        return envCache[modeName];
    }
    scene.environment = buildEnv(st.mode);

    /* ---------- ground ---------- */
    function makeGroundTexture() {
        const c = document.createElement('canvas');
        c.width = c.height = 1024;
        const g = c.getContext('2d');
        g.fillStyle = '#47763a';
        g.fillRect(0, 0, 1024, 1024);
        // soft mow stripes (match the 2D game's look)
        const stripePx = 1024 / COLS * 8;
        for (let x = 0; x < 1024; x += stripePx) {
            const grad = g.createLinearGradient(x, 0, x + stripePx, 0);
            grad.addColorStop(0, 'rgba(225,235,130,0.16)');
            grad.addColorStop(0.4, 'rgba(225,235,130,0.16)');
            grad.addColorStop(0.6, 'rgba(20,60,10,0.12)');
            grad.addColorStop(0.95, 'rgba(20,60,10,0.12)');
            grad.addColorStop(1, 'rgba(225,235,130,0.16)');
            g.fillStyle = grad;
            g.fillRect(x, 0, stripePx, 1024);
        }
        // turf speckle
        for (let i = 0; i < 26000; i++) {
            const v = Math.random();
            g.fillStyle = v < 0.5
                ? `rgba(20,50,15,${0.05 + Math.random() * 0.12})`
                : `rgba(190,220,110,${0.04 + Math.random() * 0.1})`;
            const s = 1 + Math.random() * 2.2;
            g.fillRect(Math.random() * 1024, Math.random() * 1024, s, s);
        }
        const tex = new THREE.CanvasTexture(c);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
        return tex;
    }
    const groundMat = new THREE.MeshStandardMaterial({
        map: makeGroundTexture(), roughness: 0.96, metalness: 0.0,
        color: new THREE.Color(pal.groundTint)
    });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(W * 3, H * 3), groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    ground.material.map.wrapS = ground.material.map.wrapT = THREE.RepeatWrapping;
    ground.material.map.repeat.set(3, 3);
    scene.add(ground);

    /* ---------- mow mask (shared truth with the 2D game) ---------- */
    const maskData = new Uint8Array(COLS * ROWS);
    const maskTex = new THREE.DataTexture(maskData, COLS, ROWS, THREE.RedFormat, THREE.UnsignedByteType);
    maskTex.magFilter = THREE.LinearFilter;
    maskTex.minFilter = THREE.LinearFilter;
    let lastMaskVersion = -1;
    function syncMask() {
        const s = bridge.state();
        if (s.maskVersion === lastMaskVersion) return;
        lastMaskVersion = s.maskVersion;
        const mowed = s.mowed;
        for (let i = 0; i < maskData.length; i++) maskData[i] = mowed[i] ? 255 : 0;
        maskTex.needsUpdate = true;
    }
    syncMask();

    /* ---------- grass ---------- */
    function bladeGeometry() {
        // tapered 3-segment blade, 7 verts; y = height fraction
        const SEG = 3, W0 = 0.075;
        const pos = [], hgt = [], idx = [];
        for (let i = 0; i <= SEG; i++) {
            const h = i / (SEG + 1);
            const w = W0 * (1 - h * 0.7);
            pos.push(-w / 2, h, 0, w / 2, h, 0);
            hgt.push(h, h);
        }
        pos.push(0, 1, 0); hgt.push(1); // tip
        for (let i = 0; i < SEG; i++) {
            const a = i * 2;
            idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
        }
        idx.push(SEG * 2, SEG * 2 + 1, SEG * 2 + 2);
        const g = new THREE.InstancedBufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        g.setAttribute('aH', new THREE.Float32BufferAttribute(hgt, 1));
        g.setIndex(idx);
        return g;
    }

    const grassGeo = bladeGeometry();
    grassGeo.instanceCount = BLADES;
    const iPosArr = new Float32Array(BLADES * 2);
    {
        const iDat = new Float32Array(BLADES * 4); // scale, angle, phase, shade
        for (let i = 0; i < BLADES; i++) {
            iDat[i * 4] = 0.55 + Math.random() * 0.5;       // height scale
            iDat[i * 4 + 1] = Math.random() * Math.PI * 2;  // yaw
            iDat[i * 4 + 2] = Math.random();                // phase
            iDat[i * 4 + 3] = Math.random();                // shade
        }
        grassGeo.setAttribute('iPos', new THREE.InstancedBufferAttribute(iPosArr, 2));
        grassGeo.setAttribute('iDat', new THREE.InstancedBufferAttribute(iDat, 4));
    }
    grassGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 400);

    const grassUni = {
        uTime: { value: 0 },
        uMask: { value: maskTex },
        uGrid: { value: new THREE.Vector2(COLS, ROWS) },
        uWind: { value: new THREE.Vector2(0.8, 0.45).normalize() },
        uBladeH: { value: 0.85 },
        uSunDir: { value: new THREE.Vector3().fromArray(pal.sunDir).normalize() },
        uSunCol: { value: new THREE.Color(pal.sunCol).multiplyScalar(pal.sunInt * 0.55) },
        uSkyCol: { value: new THREE.Color(pal.hemiSky) },
        uBase: { value: new THREE.Color(pal.base) },
        uTip: { value: new THREE.Color(pal.tip) },
        uStubble: { value: new THREE.Vector3().fromArray(pal.stubble) },
        fogColor: { value: new THREE.Color(pal.fog) },
        fogDensity: { value: pal.fogD }
    };

    const grassMat = new THREE.ShaderMaterial({
        uniforms: grassUni,
        side: THREE.DoubleSide,
        vertexShader: `
            attribute vec2 iPos;
            attribute vec4 iDat; // scale, angle, phase, shade
            attribute float aH;
            uniform sampler2D uMask;
            uniform vec2 uGrid;
            uniform float uTime, uBladeH;
            uniform vec2 uWind;
            varying float vH, vCut, vShade, vFog;
            varying vec3 vWorld;
            void main() {
                // the mow grid is screen-space (same as the 8-bit game):
                // sample the mask by the blade base's projected position
                vec4 baseClip = projectionMatrix * viewMatrix * vec4(iPos.x, 0.0, iPos.y, 1.0);
                vec2 suv = baseClip.xy / baseClip.w * 0.5 + 0.5;
                float m = texture2D(uMask, vec2(suv.x, 1.0 - suv.y)).r;
                float cut = smoothstep(0.35, 0.65, m);
                float hgt = uBladeH * iDat.x * mix(1.0, 0.13, cut);
                float cA = cos(iDat.y), sA = sin(iDat.y);
                // layered wind: field sway + traveling gust + per-blade flutter
                float g1 = sin(dot(iPos, uWind) * 0.30 - uTime * 1.5);
                float g2 = sin(dot(iPos, vec2(-uWind.y, uWind.x)) * 0.17 + uTime * 0.85 + 2.0);
                float fl = sin(uTime * 3.4 + iDat.z * 6.2832);
                float sway = (g1 * 0.6 + g2 * 0.4) * (1.0 - cut * 0.92);
                float bend = 0.22 + 0.18 * sin(iDat.z * 12.566) + sway * 0.42 + fl * 0.07;
                float h = aH;
                float yy = position.y * hgt * (1.0 - 0.16 * abs(bend) * h * h);
                vec2 lat = vec2(position.x * cA, position.x * sA);
                vec2 leanDir = normalize(uWind + vec2(sA, -cA) * 0.35);
                vec2 xz = iPos + lat + leanDir * (bend * hgt * h * h);
                vec3 wp = vec3(xz.x, yy, xz.y);
                vH = h; vCut = cut; vShade = iDat.w; vWorld = wp;
                vec4 mv = viewMatrix * vec4(wp, 1.0);
                vFog = -mv.z;
                gl_Position = projectionMatrix * mv;
            }`,
        fragmentShader: `
            precision highp float;
            uniform vec3 uSunDir, uSunCol, uSkyCol, uBase, uTip, uStubble;
            uniform vec3 fogColor;
            uniform float fogDensity;
            varying float vH, vCut, vShade, vFog;
            varying vec3 vWorld;
            void main() {
                vec3 col = mix(uBase, uTip, vH * vH * 0.85 + vH * 0.15);
                col *= 0.88 + vShade * 0.24;
                col = mix(col, col * uStubble, vCut);
                float ao = mix(0.42, 1.0, vH);
                float ndl = clamp(0.5 + 0.5 * uSunDir.y, 0.0, 1.0);
                vec3 V = normalize(cameraPosition - vWorld);
                float sss = pow(clamp(dot(V, -uSunDir), 0.0, 1.0), 3.0) * vH;
                vec3 light = uSkyCol * 0.55 + uSunCol * ndl;
                col = col * light * ao + uSunCol * sss * vec3(0.55, 0.75, 0.25) * 0.4;
                float f = 1.0 - exp(-fogDensity * fogDensity * vFog * vFog);
                col = mix(col, fogColor, clamp(f, 0.0, 1.0));
                gl_FragColor = vec4(col, 1.0);
            }`
    });
    const grass = new THREE.Mesh(grassGeo, grassMat);
    grass.frustumCulled = false;
    scene.add(grass);

    /* ---------- mower (procedural PBR) ---------- */
    const mower = new THREE.Group();
    const wheels = [];
    {
        const red = new THREE.MeshStandardMaterial({ color: 0xc62a1c, roughness: 0.32, metalness: 0.35 });
        const darkRed = new THREE.MeshStandardMaterial({ color: 0x8e1a10, roughness: 0.45, metalness: 0.3 });
        const black = new THREE.MeshStandardMaterial({ color: 0x16181b, roughness: 0.8, metalness: 0.05 });
        const rubber = new THREE.MeshStandardMaterial({ color: 0x0c0d0f, roughness: 0.92 });
        const alu = new THREE.MeshStandardMaterial({ color: 0xb8bec6, roughness: 0.22, metalness: 0.92 });
        const darkPlastic = new THREE.MeshStandardMaterial({ color: 0x24272b, roughness: 0.6, metalness: 0.1 });

        function add(mesh, x, y, z) {
            mesh.position.set(x, y, z);
            mesh.castShadow = true;
            mower.add(mesh);
            return mesh;
        }
        // deck + skirt
        add(new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.18, 1.25), black), 0, 0.30, 0);
        const deck = add(new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.42, 1.15), red), 0, 0.58, 0);
        deck.geometry.translate(0, 0, 0);
        add(new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.2, 0.95), darkRed), -0.15, 0.86, 0);
        // battery hatch + motor
        add(new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.3, 0.55), darkPlastic), -0.35, 1.04, 0);
        const motor = add(new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.24, 0.3, 20), alu), 0.35, 1.0, 0);
        add(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.1, 12), black), 0.35, 1.2, 0);
        void motor;
        // wheels
        function wheel(r, x, z) {
            const grp = new THREE.Group();
            const tire = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.16, 24), rubber);
            tire.rotation.x = Math.PI / 2;
            tire.castShadow = true;
            const hub = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.55, r * 0.55, 0.17, 16), darkPlastic);
            hub.rotation.x = Math.PI / 2;
            const cap = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.18, r * 0.18, 0.18, 12), red);
            cap.rotation.x = Math.PI / 2;
            const spoke = new THREE.Mesh(new THREE.BoxGeometry(r * 0.9, 0.04, 0.18), alu);
            grp.add(tire, hub, cap, spoke);
            grp.position.set(x, r, z);
            mower.add(grp);
            wheels.push({ grp, r });
            return grp;
        }
        wheel(0.34, -0.62, 0.62);
        wheel(0.34, -0.62, -0.62);
        wheel(0.26, 0.68, 0.56);
        wheel(0.26, 0.68, -0.56);
        // handlebar
        const tube = new THREE.CylinderGeometry(0.045, 0.045, 2.1, 10);
        for (const zz of [0.42, -0.42]) {
            const t = new THREE.Mesh(tube, alu);
            t.position.set(-1.55, 1.45, zz);
            t.rotation.z = THREE.MathUtils.degToRad(-52);
            t.castShadow = true;
            mower.add(t);
        }
        const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.92, 10), red);
        bar.rotation.x = Math.PI / 2;
        bar.position.set(-2.18, 2.27, 0);
        bar.castShadow = true;
        mower.add(bar);
    }
    scene.add(mower);
    mower.scale.setScalar(1.35);
    mower.position.set(0, 0, H * 0.32);

    /* ---------- foreground mower pass (drawn ON TOP of the card) ----------
       The card is a CSS3D layer above the WebGL canvas, so a mower rendered
       in the main scene sits beneath it. We render the mower a second time to
       a transparent canvas stacked above the card. The main-scene mower stays
       (it casts the ground shadow); the overlay copy aligns pixel-for-pixel. */
    const fgRenderer = new THREE.WebGLRenderer({ alpha: true, antialias: isMobile });
    fgRenderer.setPixelRatio(DPR);
    fgRenderer.setSize(innerWidth, innerHeight);
    fgRenderer.outputColorSpace = THREE.SRGBColorSpace;
    fgRenderer.toneMapping = THREE.ACESFilmicToneMapping;
    const fgCanvas = fgRenderer.domElement;
    fgCanvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:7;pointer-events:none;display:none;';
    document.body.appendChild(fgCanvas);
    const fgScene = new THREE.Scene();
    const fgHemi = new THREE.HemisphereLight(pal.hemiSky, pal.hemiGnd, pal.hemiInt);
    const fgSun = new THREE.DirectionalLight(pal.sunCol, pal.sunInt);
    fgScene.add(fgHemi, fgSun, fgSun.target);
    const fgPmrem = new THREE.PMREMGenerator(fgRenderer);
    const fgEnvCache = {};
    function buildFgEnv(modeName) {
        if (fgEnvCache[modeName]) return fgEnvCache[modeName];
        fgEnvCache[modeName] = fgPmrem.fromScene(buildEnvScene(modeName), 0.05).texture;
        return fgEnvCache[modeName];
    }
    function syncFgLights(modeName) {
        fgHemi.color.set(pal.hemiSky); fgHemi.groundColor.set(pal.hemiGnd); fgHemi.intensity = pal.hemiInt;
        fgSun.color.set(pal.sunCol); fgSun.intensity = pal.sunInt;
        fgSun.position.set(pal.sunDir[0] * 80, pal.sunDir[1] * 80, pal.sunDir[2] * 80);
        fgSun.target.position.set(0, 0, 0);
        fgScene.environment = buildFgEnv(modeName);
    }
    syncFgLights(st.mode);

    /* ---------- clippings (3D particles) ---------- */
    const CLIP_MAX = 240;
    const clipMesh = new THREE.InstancedMesh(
        new THREE.BoxGeometry(0.05, 0.012, 0.16),
        new THREE.MeshStandardMaterial({ color: 0x5d9c34, roughness: 0.9 }),
        CLIP_MAX
    );
    clipMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    clipMesh.count = 0;
    scene.add(clipMesh);
    const clips = [];
    const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(1, 1, 1);
    const _v3 = new THREE.Vector3();
    function spawnClips(cx, cz, n) {
        for (let i = 0; i < n; i++) {
            if (clips.length >= CLIP_MAX) clips.shift();
            clips.push({
                x: cx + (Math.random() - 0.5) * 0.8, y: 0.3 + Math.random() * 0.3, z: cz + (Math.random() - 0.5) * 0.8,
                vx: (Math.random() - 0.5) * 0.06, vy: 0.05 + Math.random() * 0.08, vz: (Math.random() - 0.5) * 0.06,
                rx: Math.random() * 6, rz: Math.random() * 6, life: 1
            });
        }
    }
    function updateClips(dt) {
        for (let i = clips.length - 1; i >= 0; i--) {
            const p = clips[i];
            p.x += p.vx; p.y += p.vy; p.z += p.vz;
            p.vy -= 0.0045 * dt;
            p.rx += 0.1 * dt; p.rz += 0.13 * dt;
            p.life -= 0.012 * dt;
            if (p.life <= 0 || p.y < 0.01) clips.splice(i, 1);
        }
        clipMesh.count = clips.length;
        for (let i = 0; i < clips.length; i++) {
            const p = clips[i];
            _e.set(p.rx, 0, p.rz);
            _q.setFromEuler(_e);
            _m4.compose(new THREE.Vector3(p.x, p.y, p.z), _q, _s);
            clipMesh.setMatrixAt(i, _m4);
        }
        if (clips.length) clipMesh.instanceMatrix.needsUpdate = true;
    }

    /* ---------- post-processing ---------- */
    const composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType, multisampling: 0 });
    composer.addPass(new RenderPass(scene, camera));
    const fx = [];
    fx.push(new BloomEffect({ intensity: 0.5, luminanceThreshold: 0.72, mipmapBlur: true }));
    fx.push(new VignetteEffect({ darkness: 0.34, offset: 0.42 }));
    fx.push(new NoiseEffect({ blendFunction: BlendFunction.COLOR_DODGE, premultiply: true }));
    fx[fx.length - 1].blendMode.opacity.value = 0.04;
    fx.push(new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC }));
    composer.addPass(new EffectPass(camera, ...fx));
    if (!isMobile) {
        composer.addPass(new EffectPass(camera, new SMAAEffect()));
    }

    /* ---------- pointer / mowing ---------- */
    const ray = new THREE.Raycaster();
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const ndc = new THREE.Vector2();
    const hit = new THREE.Vector3();
    const target = new THREE.Vector3(mower.position.x, 0, mower.position.z);
    let hasPointer = false;
    let lastMoveAt = 0;

    function onPointer(e) {
        ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
        ray.setFromCamera(ndc, camera);
        if (ray.ray.intersectPlane(groundPlane, hit)) {
            target.set(hit.x, 0, hit.z);
            hasPointer = true;
            lastMoveAt = performance.now();
        }
    }

    /* ---------- blade distribution over the visible ground ---------- */
    const _c = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
    function groundAtNdc(x, y, out) {
        ray.setFromCamera(ndc.set(x, y), camera);
        return ray.ray.intersectPlane(groundPlane, out);
    }
    function redistribute() {
        placeCamera();
        // screen corners (with margin) projected onto the ground
        groundAtNdc(-1.08, -1.1, _c[0]); // bottom-left
        groundAtNdc(1.08, -1.1, _c[1]);  // bottom-right
        groundAtNdc(-1.08, 1.06, _c[2]); // top-left
        groundAtNdc(1.08, 1.06, _c[3]);  // top-right
        for (let i = 0; i < BLADES; i++) {
            const u = Math.random(), v = Math.random();
            const bx = _c[0].x + (_c[1].x - _c[0].x) * u;
            const bz = _c[0].z + (_c[1].z - _c[0].z) * u;
            const tx = _c[2].x + (_c[3].x - _c[2].x) * u;
            const tz = _c[2].z + (_c[3].z - _c[2].z) * u;
            iPosArr[i * 2] = bx + (tx - bx) * v;
            iPosArr[i * 2 + 1] = bz + (tz - bz) * v;
        }
        grassGeo.getAttribute('iPos').needsUpdate = true;
    }
    redistribute();

    /* ---------- the card, hidden UNDER the grass ----------
       Desktop: a CSS3D object lying on the lawn, perspective-matched.
       Both: clipped by a screen-space CSS mask built from the mow grid,
       so the card is only visible where the grass above it is cut —
       exactly like the 8-bit reveal. */
    const panel = document.querySelector('.panel');
    const sceneEl = document.querySelector('.scene');
    let css3d = null, cssScene = null, cardHome = null, cardObj = null;
    let maskTarget = null;
    let cardTick = 0;
    if (panel && !matchMedia('(pointer: coarse)').matches) {
        css3d = new CSS3DRenderer();
        css3d.setSize(innerWidth, innerHeight);
        css3d.domElement.style.cssText = 'position:fixed;inset:0;z-index:6;pointer-events:none;';
        document.body.appendChild(css3d.domElement);
        cardHome = panel.parentNode;
        cssScene = new THREE.Scene();
    }
    // (Re)build the CSS3D card object. Recreated on every adopt so the
    // renderer's per-object transform cache misses and rewrites the matrix —
    // otherwise an unchanged camera/object after a mode toggle leaves the card
    // with no transform and it renders at full native size.
    function mountCardObj() {
        if (!css3d) return;
        if (cardObj) cssScene.remove(cardObj);
        cardObj = new CSS3DObject(panel);
        cardObj.rotation.x = -Math.PI / 2 + 0.22; // lying on the lawn, slight tilt for readability
        cardObj.position.set(0, 0.12, -0.5);
        cardObj.scale.setScalar(0.032);
        cssScene.add(cardObj);
    }
    maskTarget = css3d ? css3d.domElement : sceneEl;

    // screen-space reveal mask from the shared mow grid
    const cssMaskCv = document.createElement('canvas');
    cssMaskCv.width = COLS;
    cssMaskCv.height = ROWS;
    const cssMaskCtx = cssMaskCv.getContext('2d');
    const cssMaskImg = cssMaskCtx.createImageData(COLS, ROWS);
    let cssMaskVersion = -1;
    function updateCssMask(force) {
        if (!maskTarget) return;
        const s = bridge.state();
        if (!force && s.maskVersion === cssMaskVersion) return;
        cssMaskVersion = s.maskVersion;
        const d = cssMaskImg.data;
        const mowed = s.mowed;
        for (let i = 0; i < mowed.length; i++) {
            const o = i * 4;
            d[o] = d[o + 1] = d[o + 2] = 255;
            d[o + 3] = mowed[i] ? 255 : 0;
        }
        cssMaskCtx.putImageData(cssMaskImg, 0, 0);
        const url = 'url(' + cssMaskCv.toDataURL() + ')';
        maskTarget.style.webkitMaskImage = url;
        maskTarget.style.maskImage = url;
        maskTarget.style.webkitMaskSize = '100% 100%';
        maskTarget.style.maskSize = '100% 100%';
    }

    function updateCardReveal() {
        if (!panel) return;
        const s = bridge.state();
        const r = panel.getBoundingClientRect();
        let tot = 0, mw = 0;
        const c0 = Math.max(0, Math.floor(r.left / innerWidth * s.cols));
        const c1 = Math.min(s.cols - 1, Math.ceil(r.right / innerWidth * s.cols));
        const r0 = Math.max(0, Math.floor(r.top / innerHeight * s.rows));
        const r1 = Math.min(s.rows - 1, Math.ceil(r.bottom / innerHeight * s.rows));
        for (let rr = r0; rr <= r1; rr++) {
            for (let cc = c0; cc <= c1; cc++) { tot++; if (s.mowed[rr * s.cols + cc]) mw++; }
        }
        const frac = s.finished ? 1 : (tot ? mw / tot : 0);
        panel.style.pointerEvents = (s.finished || frac > 0.55) ? 'auto' : 'none';
    }

    function adoptCard() {
        if (!panel) return;
        document.body.classList.add('card3d'); // index.html hands the card over to us
        if (css3d) css3d.domElement.style.display = 'block';
        panel.style.opacity = '1'; // the mask does the hiding
        mountCardObj();            // fresh object => transform gets rewritten
        updateCssMask(true);
    }
    function releaseCard() {
        if (!panel) return;
        document.body.classList.remove('card3d');
        if (css3d) {
            css3d.domElement.style.display = 'none';
            cardHome.appendChild(panel);
        }
        maskTarget.style.webkitMaskImage = '';
        maskTarget.style.maskImage = '';
        panel.style.position = '';
        panel.style.transform = '';
        panel.style.opacity = '';
        panel.style.pointerEvents = '';
    }

    /* ---------- mode switching ---------- */
    function setMode(m) {
        pal = PALS[m] || PALS.day;
        skyUni.top.value.set(pal.skyTop);
        skyUni.bot.value.set(pal.skyBot);
        sun.color.set(pal.sunCol);
        sun.intensity = pal.sunInt;
        hemi.color.set(pal.hemiSky);
        hemi.groundColor.set(pal.hemiGnd);
        hemi.intensity = pal.hemiInt;
        applySunDir();
        scene.fog.color.set(pal.fog);
        scene.fog.density = pal.fogD;
        scene.environment = buildEnv(m);
        groundMat.color.set(pal.groundTint);
        grassUni.uSunDir.value.fromArray(pal.sunDir).normalize();
        grassUni.uSunCol.value.set(pal.sunCol).multiplyScalar(pal.sunInt * 0.55);
        grassUni.uSkyCol.value.set(pal.hemiSky);
        grassUni.uBase.value.set(pal.base);
        grassUni.uTip.value.set(pal.tip);
        grassUni.uStubble.value.fromArray(pal.stubble);
        syncFgLights(m);
    }

    /* ---------- main loop ---------- */
    let running = false;
    let rafId = 0;
    let last = 0;
    let frameToggle = false;
    let prevMower = new THREE.Vector3().copy(mower.position);
    let yaw = Math.PI, yawTarget = Math.PI;
    let wasFinished = bridge.state().finished;
    let finishedAt = 0;

    function loop(t) {
        if (!running) return;
        rafId = requestAnimationFrame(loop);

        // idle throttle: 30fps when no pointer activity (battery/thermal)
        const idle = t - lastMoveAt > 4000;
        frameToggle = !frameToggle;
        if (idle && frameToggle) return;

        const dt = Math.min(3, (t - last) / 16.7 || 1);
        last = t;
        grassUni.uTime.value = t * 0.001;

        const s = bridge.state();
        syncMask();

        // mower follow + mow
        if (hasPointer && !s.finished) {
            mower.position.lerp(target, 0.10 * dt);
            const vx = mower.position.x - prevMower.x;
            const vz = mower.position.z - prevMower.z;
            const speed = Math.sqrt(vx * vx + vz * vz);
            if (speed > 0.015) {
                yawTarget = Math.atan2(vz, vx) + Math.PI; // model faces -x? handle flip
                // mow grid is screen-space: cut where the mower appears on screen
                _v3.copy(mower.position).project(camera);
                bridge.mowScreen((_v3.x * 0.5 + 0.5) * innerWidth, (1 - (_v3.y * 0.5 + 0.5)) * innerHeight);
            }
            let dy = yawTarget - yaw;
            while (dy > Math.PI) dy -= Math.PI * 2;
            while (dy < -Math.PI) dy += Math.PI * 2;
            yaw += dy * 0.15 * dt;
            mower.rotation.y = -yaw;
            for (const w of wheels) w.grp.rotation.z -= speed / w.r * 1.0;
            prevMower.copy(mower.position);
        }

        // clippings spray from the mower as tiles get cut
        const mows = bridge.popMows();
        if (mows.length) spawnClips(mower.position.x, mower.position.z, Math.min(8, mows.length + 2));
        updateClips(dt);

        // LEVEL CLEAR: slow camera push-in
        if (s.finished && !wasFinished) { wasFinished = true; finishedAt = t; }
        if (wasFinished) pushIn = Math.min(1, (t - finishedAt) / 2400);
        placeCamera();

        composer.render();
        // mower again, on its own layer above the card
        scene.remove(mower);
        fgScene.add(mower);
        fgRenderer.render(fgScene, camera);
        fgScene.remove(mower);
        scene.add(mower);
        if (cardObj) css3d.render(cssScene, camera);
        if (panel && (++cardTick % 6 === 0 || s.finished)) {
            updateCssMask();
            updateCardReveal();
        }
    }

    /* ---------- lifecycle ---------- */
    function start() {
        if (running) return;
        running = true;
        canvas.style.display = 'block';
        fgCanvas.style.display = 'block';
        adoptCard();
        last = performance.now();
        lastMoveAt = last;
        window.addEventListener('pointermove', onPointer);
        window.addEventListener('pointerdown', onPointer);
        rafId = requestAnimationFrame(loop);
    }
    function stop() {
        running = false;
        cancelAnimationFrame(rafId);
        canvas.style.display = 'none';
        fgCanvas.style.display = 'none';
        releaseCard();
        window.removeEventListener('pointermove', onPointer);
        window.removeEventListener('pointerdown', onPointer);
    }

    function onResize() {
        camera.aspect = innerWidth / innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(innerWidth, innerHeight);
        composer.setSize(innerWidth, innerHeight);
        fgRenderer.setSize(innerWidth, innerHeight);
        if (css3d) css3d.setSize(innerWidth, innerHeight);
        redistribute();
    }
    window.addEventListener('resize', onResize);

    canvas.addEventListener('webglcontextlost', (e) => {
        e.preventDefault();
        stop();
        if (bridge.fail) bridge.fail('context lost');
    });

    // first-frame warmup (compiles shaders while the loading screen shows)
    renderer.compile(scene, camera);
    composer.render();

    return { start, stop, setMode, canvas };
}
