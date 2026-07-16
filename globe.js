(function () {
  const container = document.getElementById('globeContainer');
  const canvas = document.getElementById('globeCanvas');
  const hint = document.getElementById('globeHint');
  if (!container || !canvas) return;

  if (!window.THREE || !window.THREE.OrbitControls) {
    if (hint) hint.textContent = '3D 지구본을 불러오지 못했습니다 (Three.js 로드 실패).';
    console.error('Three.js or OrbitControls did not load.');
    return;
  }

  const DATA = Array.isArray(window.UNIVERSITIES) ? window.UNIVERSITIES : [];
  const COORDS = window.CITY_COORDS || {};
  const TEX_BASE = 'https://threejs.org/examples/textures/planets/';
  const EARTH_DAY_TEXTURE_URL = 'https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-blue-marble.jpg';
  const COUNTRY_BORDERS_URL = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson';
  const RADIUS = 5;
  const MARKER_BASE_SCALE = 0.3;

  let colorized = false;
  let isAnimatingCamera = false;
  let grayMesh = null;
  let colorMesh = null;
  let cloudMesh = null;
  let bordersGroup = null;
  const markers = [];

  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
  camera.position.set(0, 1.2, 13);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.outputEncoding = THREE.sRGBEncoding;

  const controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = RADIUS * 1.25;
  controls.maxDistance = RADIUS * 4.5;
  controls.rotateSpeed = 0.5;
  controls.zoomSpeed = 0.7;
  controls.enablePan = false;

  scene.add(new THREE.AmbientLight(0xffffff, 0.55));
  const sun = new THREE.DirectionalLight(0xffffff, 1.15);
  sun.position.set(6, 3, 5);
  scene.add(sun);

  // starfield backdrop
  (function addStars() {
    const count = 2500;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = 120 + Math.random() * 200;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.9, sizeAttenuation: true, transparent: true, opacity: 0.8 });
    scene.add(new THREE.Points(geo, mat));
  })();

  const earthGroup = new THREE.Group();
  scene.add(earthGroup);

  function resize() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (w === 0 || h === 0) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  window.addEventListener('resize', resize);

  // --- markers ---
  function latLonToVector3(lat, lon, r) {
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lon + 180) * (Math.PI / 180);
    return new THREE.Vector3(
      -r * Math.sin(phi) * Math.cos(theta),
      r * Math.cos(phi),
      r * Math.sin(phi) * Math.sin(theta)
    );
  }

  function makeMarkerTexture(rgb) {
    const size = 64;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    const cx = size / 2;
    const cy = size / 2;
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, size / 2);
    grad.addColorStop(0, 'rgba(255,255,255,0.9)');
    grad.addColorStop(0.16, `rgba(${rgb},1)`);
    grad.addColorStop(0.38, `rgba(${rgb},0.35)`);
    grad.addColorStop(0.55, `rgba(${rgb},0)`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
    ctx.fill();
    return new THREE.CanvasTexture(c);
  }

  const markerTexture = makeMarkerTexture('255,59,48');
  const markerTextureHover = makeMarkerTexture('52,199,89');
  let hoveredSprite = null;

  function buildMarkers() {
    const groups = new Map();
    DATA.forEach((u, idx) => {
      const cityRaw = (u.city || '').split('\n')[0].trim();
      const key = `${cityRaw}|${u.country}`;
      const coord = COORDS[key];
      if (!coord) return;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(idx);
    });

    groups.forEach((idxList, key) => {
      const [lat, lon] = COORDS[key];
      const basePos = latLonToVector3(lat, lon, RADIUS);
      const normal = basePos.clone().normalize();
      const arbitrary = Math.abs(normal.y) < 0.99 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
      const tangentA = new THREE.Vector3().crossVectors(arbitrary, normal).normalize();
      const tangentB = new THREE.Vector3().crossVectors(normal, tangentA).normalize();

      idxList.forEach((idx, i) => {
        const pos = basePos.clone();
        if (idxList.length > 1) {
          const angle = (i / idxList.length) * Math.PI * 2;
          const spread = 0.16;
          pos.add(tangentA.clone().multiplyScalar(Math.cos(angle) * spread));
          pos.add(tangentB.clone().multiplyScalar(Math.sin(angle) * spread));
        }
        pos.normalize().multiplyScalar(RADIUS + 0.05);

        const material = new THREE.SpriteMaterial({ map: markerTexture, transparent: true, depthTest: true });
        const sprite = new THREE.Sprite(material);
        sprite.position.copy(pos);
        sprite.scale.set(MARKER_BASE_SCALE, MARKER_BASE_SCALE, 1);
        sprite.userData = { idx };
        earthGroup.add(sprite);
        markers.push(sprite);
      });
    });
  }

  // --- country border overlay ---
  function ringToSegments(ring) {
    // Split wherever consecutive points jump across the antimeridian, so
    // e.g. Russia/Fiji/Alaska don't draw a spurious line across the globe.
    const segments = [[]];
    let prevLon = null;
    ring.forEach(([lon, lat]) => {
      if (prevLon !== null && Math.abs(lon - prevLon) > 180) {
        segments.push([]);
      }
      segments[segments.length - 1].push(latLonToVector3(lat, lon, RADIUS * 1.003));
      prevLon = lon;
    });
    return segments.filter((seg) => seg.length > 1);
  }

  function buildCountryBorders(geojson) {
    bordersGroup = new THREE.Group();
    const material = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 });

    geojson.features.forEach((feature) => {
      const geom = feature.geometry;
      if (!geom) return;
      const polygons = geom.type === 'Polygon' ? [geom.coordinates] : geom.type === 'MultiPolygon' ? geom.coordinates : [];
      polygons.forEach((polygon) => {
        polygon.forEach((ring) => {
          ringToSegments(ring).forEach((points) => {
            const geo = new THREE.BufferGeometry().setFromPoints(points);
            bordersGroup.add(new THREE.Line(geo, material));
          });
        });
      });
    });

    if (colorized) {
      bordersGroup.children.forEach((l) => { l.material.opacity = BORDERS_OPACITY; });
    }
    earthGroup.add(bordersGroup);
  }

  function fetchCountryBorders() {
    fetch(COUNTRY_BORDERS_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((geojson) => buildCountryBorders(geojson))
      .catch((err) => console.error('[globe] failed to load country borders', err));
  }

  // --- earth build (grayscale + color crossfade) ---
  const loader = new THREE.TextureLoader();
  loader.crossOrigin = 'anonymous';

  loader.load(
    EARTH_DAY_TEXTURE_URL,
    (colorTex) => {
      colorTex.encoding = THREE.sRGBEncoding;
      buildEarth(colorTex);
    },
    undefined,
    (err) => {
      console.error('Failed to load earth texture', err);
      if (hint) hint.textContent = '지구 텍스처를 불러오지 못했습니다.';
    }
  );

  fetchCountryBorders();

  function desaturate(image) {
    const t0 = performance.now();
    const c = document.createElement('canvas');
    c.width = image.width;
    c.height = image.height;
    const ctx = c.getContext('2d');
    ctx.drawImage(image, 0, 0);
    const imageData = ctx.getImageData(0, 0, c.width, c.height);
    const d = imageData.data;
    for (let i = 0; i < d.length; i += 4) {
      const gray = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
      d[i] = gray;
      d[i + 1] = gray;
      d[i + 2] = gray;
    }
    ctx.putImageData(imageData, 0, 0);
    console.log(`[globe] desaturated ${c.width}x${c.height} in ${(performance.now() - t0).toFixed(1)}ms`);
    return c;
  }

  function buildEarth(colorTex) {
    const grayCanvas = desaturate(colorTex.image);
    const grayTex = new THREE.CanvasTexture(grayCanvas);
    grayTex.encoding = THREE.sRGBEncoding;
    grayTex.needsUpdate = true;

    const geo = new THREE.SphereGeometry(RADIUS, 96, 96);
    grayMesh = new THREE.Mesh(geo, new THREE.MeshPhongMaterial({ map: grayTex, shininess: 4 }));
    earthGroup.add(grayMesh);

    const colorGeo = new THREE.SphereGeometry(RADIUS * 1.001, 96, 96);
    colorMesh = new THREE.Mesh(
      colorGeo,
      new THREE.MeshPhongMaterial({ map: colorTex, shininess: 12, transparent: true, opacity: 0 })
    );
    earthGroup.add(colorMesh);

    loader.load(TEX_BASE + 'earth_normal_2048.jpg', (bump) => {
      grayMesh.material.bumpMap = bump;
      grayMesh.material.bumpScale = 0.05;
      grayMesh.material.needsUpdate = true;
      colorMesh.material.bumpMap = bump;
      colorMesh.material.bumpScale = 0.05;
      colorMesh.material.needsUpdate = true;
    });

    loader.load(TEX_BASE + 'earth_specular_2048.jpg', (spec) => {
      colorMesh.material.specularMap = spec;
      colorMesh.material.needsUpdate = true;
    });

    loader.load(TEX_BASE + 'earth_clouds_1024.png', (cloudTex) => {
      const cloudGeo = new THREE.SphereGeometry(RADIUS * 1.015, 64, 64);
      cloudMesh = new THREE.Mesh(
        cloudGeo,
        new THREE.MeshPhongMaterial({ map: cloudTex, transparent: true, opacity: 0, depthWrite: false })
      );
      earthGroup.add(cloudMesh);
    });

    buildMarkers();
    resize();
    if (hint) hint.textContent = '지구본을 클릭해 색을 입혀보세요';
    animate();
  }

  // --- colorize transition ---
  function easeInOutQuad(t) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }

  const BORDERS_OPACITY = 0.4;

  function triggerColorize() {
    if (colorized || !colorMesh) return;
    colorized = true;
    const start = performance.now();
    const duration = 1400;
    function step(now) {
      const t = Math.min((now - start) / duration, 1);
      const eased = easeInOutQuad(t);
      colorMesh.material.opacity = eased;
      if (cloudMesh) cloudMesh.material.opacity = eased * 0.85;
      if (bordersGroup) bordersGroup.children.forEach((l) => { l.material.opacity = eased * BORDERS_OPACITY; });
      if (t < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);

    if (hint) {
      hint.textContent = '핀을 클릭해 학교 정보를 확인하세요';
      setTimeout(() => hint.classList.add('hidden'), 3500);
    }
  }

  // --- camera fly-to-marker (shared by click and hover) ---
  // Each call gets its own token, so a newer flight always supersedes an
  // older one instead of both fighting over camera.position every frame
  // (that fight was producing a resting camera pose — and detail popup —
  // for neither of the two intended destinations).
  let flightToken = 0;
  let detailFlightActive = false;

  function flyToMarker(sprite, { openDetail = false, distanceScale = 1.55, duration = 1100 } = {}) {
    const targetDir = sprite.position.clone().normalize();
    const targetCamPos = targetDir.multiplyScalar(RADIUS * distanceScale);
    const startCamPos = camera.position.clone();
    const startTarget = controls.target.clone();
    const endTarget = new THREE.Vector3(0, 0, 0);

    const myToken = ++flightToken;
    isAnimatingCamera = true;
    if (openDetail) detailFlightActive = true;
    const start = performance.now();

    function step(now) {
      if (myToken !== flightToken) return; // superseded by a newer flight
      const t = Math.min((now - start) / duration, 1);
      const eased = easeInOutQuad(t);
      camera.position.lerpVectors(startCamPos, targetCamPos, eased);
      controls.target.lerpVectors(startTarget, endTarget, eased);
      if (t < 1) {
        requestAnimationFrame(step);
      } else {
        isAnimatingCamera = false;
        if (openDetail) {
          detailFlightActive = false;
          const idx = sprite.userData.idx;
          if (window.openUniversityDetail) window.openUniversityDetail(idx);
        }
      }
    }
    requestAnimationFrame(step);
  }

  function zoomToMarker(sprite) {
    flyToMarker(sprite, { openDetail: true, distanceScale: 1.55, duration: 1100 });
  }

  // --- hover from the university card list: turn the globe to reveal the pin ---
  window.focusUniversityOnGlobe = function (idx) {
    if (!grayMesh) return;
    if (detailFlightActive) return; // don't let a hover preview hijack a committed click-to-detail flight
    const sprite = markers.find((m) => m.userData.idx === idx);
    if (!sprite) return;

    if (hoveredSprite && hoveredSprite !== sprite) {
      hoveredSprite.material.map = markerTexture;
      hoveredSprite.material.needsUpdate = true;
    }
    sprite.material.map = markerTextureHover;
    sprite.material.needsUpdate = true;
    hoveredSprite = sprite;

    flyToMarker(sprite, { openDetail: false, distanceScale: 1.3, duration: 1100 });
  };

  window.unfocusUniversityOnGlobe = function () {
    if (!hoveredSprite) return;
    hoveredSprite.material.map = markerTexture;
    hoveredSprite.material.needsUpdate = true;
    hoveredSprite = null;
  };

  // --- pointer interaction (click vs. drag) ---
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let downX = 0;
  let downY = 0;

  function updatePointer(e) {
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  }

  canvas.addEventListener('pointerdown', (e) => {
    // Don't cancel a flight that's already committed to opening a detail
    // panel — otherwise a stray click while the camera is still moving
    // toward the selected marker can re-raycast against a half-moved
    // camera and pick up a different marker underneath the cursor.
    if (isAnimatingCamera && !detailFlightActive) {
      isAnimatingCamera = false;
      flightToken++;
    }
    downX = e.clientX;
    downY = e.clientY;
  });

  canvas.addEventListener('pointerup', (e) => {
    const dx = e.clientX - downX;
    const dy = e.clientY - downY;
    if (Math.sqrt(dx * dx + dy * dy) > 6) return;
    handleClick(e);
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!grayMesh) return;
    updatePointer(e);
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(markers);
    canvas.style.cursor = hits.length ? 'pointer' : 'grab';
  });

  function handleClick(e) {
    if (!grayMesh) return;
    // A marker click already in flight owns the camera until it lands and
    // opens its detail panel — ignore further clicks so they can't
    // re-raycast against a camera that's mid-flight toward a different spot.
    if (detailFlightActive) return;
    updatePointer(e);
    raycaster.setFromCamera(pointer, camera);

    const markerHits = raycaster.intersectObjects(markers);
    if (markerHits.length) {
      triggerColorize();
      zoomToMarker(markerHits[0].object);
      return;
    }

    const globeHits = raycaster.intersectObject(grayMesh);
    if (globeHits.length) {
      triggerColorize();
    }
  }

  // --- render loop ---
  function animate() {
    requestAnimationFrame(animate);
    controls.update();

    const dist = camera.position.length();
    const t = THREE.MathUtils.clamp(
      (controls.maxDistance - dist) / (controls.maxDistance - controls.minDistance),
      0,
      1
    );
    const scale = THREE.MathUtils.lerp(0.35, 1, t);
    const opacity = THREE.MathUtils.lerp(0.35, 1, t);
    markers.forEach((m) => {
      m.scale.set(MARKER_BASE_SCALE * scale, MARKER_BASE_SCALE * scale, 1);
      m.material.opacity = opacity;
    });

    if (!colorized) earthGroup.rotation.y += 0.0009;

    renderer.render(scene, camera);
  }

  resize();
})();
