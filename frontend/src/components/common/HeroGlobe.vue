<template>
  <div ref="host" class="hero-globe" :class="{ 'is-ready': ready }" aria-hidden="true">
    <div class="globe-fallback"></div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type * as THREE from 'three'
import landCoordinates from '@/assets/earth-land.json'

const props = defineProps<{ paused: boolean }>()
const host = ref<HTMLDivElement>()
const ready = ref(false)
let disposed = false
let stop = () => {}
let syncAnimation = () => {}
watch(() => props.paused, () => syncAnimation())

onMounted(async () => {
  if (!window.WebGLRenderingContext || !host.value) return
  try {
    const T = await import('three')
    if (disposed || !host.value) return
    const element = host.value
    const renderer = new T.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' })
    renderer.setClearColor(0x000000, 0)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, window.innerWidth < 760 ? 1.25 : 1.75))
    renderer.domElement.className = 'globe-canvas'
    element.appendChild(renderer.domElement)
    const scene = new T.Scene()
    const camera = new T.PerspectiveCamera(42, 1, .1, 40)
    camera.position.set(0, 0, 7.8)
    const earth = new T.Group()
    earth.rotation.set(.32, -3.4, -.12)
    scene.add(earth)

    let frame = 0
    let visible = true
    let contextLost = false
    let previous = 0
    let elapsed = 0
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const pixelRatio = renderer.getPixelRatio()
    const orbitDots: { dot: THREE.Mesh; curve: THREE.CatmullRomCurve3; offset: number }[] = []

    const resize = () => {
      if (disposed || !element.clientWidth || !element.clientHeight) return
      renderer.setSize(element.clientWidth, element.clientHeight)
      camera.aspect = element.clientWidth / element.clientHeight
      camera.updateProjectionMatrix()
      renderer.render(scene, camera)
    }
    const resizeObserver = new ResizeObserver(resize)
    const visibilityObserver = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
      syncAnimation()
    }, { rootMargin: '60px' })
    const lostContext = (event: Event) => {
      event.preventDefault()
      contextLost = true
      ready.value = false
      cancelAnimationFrame(frame)
    }
    const restoredContext = () => {
      contextLost = false
      resize()
      ready.value = true
      syncAnimation()
    }
    const release = () => {
      cancelAnimationFrame(frame)
      resizeObserver.disconnect()
      visibilityObserver.disconnect()
      reducedMotion.removeEventListener('change', syncAnimation)
      document.removeEventListener('visibilitychange', syncAnimation)
      renderer.domElement.removeEventListener('webglcontextlost', lostContext)
      renderer.domElement.removeEventListener('webglcontextrestored', restoredContext)
      scene.traverse(object => {
        const mesh = object as THREE.Mesh
        mesh.geometry?.dispose()
        if (Array.isArray(mesh.material)) mesh.material.forEach(material => material.dispose())
        else mesh.material?.dispose()
      })
      renderer.dispose()
      renderer.domElement.remove()
    }
    stop = release

    const globe = new T.Mesh(new T.SphereGeometry(1.98, 64, 48), new T.MeshPhongMaterial({
      color: 0x06214a, emissive: 0x020c20, specular: 0x2a7fc0, shininess: 28,
    }))
    earth.add(globe)
    scene.add(new T.AmbientLight(0x709cce, 1.8))
    const light = new T.DirectionalLight(0x78caff, 2.6)
    light.position.set(-3, 3, 5)
    scene.add(light)

    const position = (lon: number, lat: number, radius = 2.005) => {
      const longitude = lon * Math.PI / 180
      const latitude = lat * Math.PI / 180
      return new T.Vector3(radius * Math.cos(latitude) * Math.cos(longitude), radius * Math.sin(latitude), -radius * Math.cos(latitude) * Math.sin(longitude))
    }
    const points = (vertices: number[], color: number, size: number, opacity: number) => {
      const geometry = new T.BufferGeometry()
      geometry.setAttribute('position', new T.Float32BufferAttribute(vertices, 3))
      const material = new T.ShaderMaterial({
        uniforms: { color: { value: new T.Color(color) }, size: { value: size * pixelRatio }, opacity: { value: opacity } },
        vertexShader: `uniform float size;
          varying float brightness;
          void main() {
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            vec3 n = normalize((modelMatrix * vec4(position, 1.0)).xyz);
            brightness = .18 + .82 * smoothstep(-.35, .85, dot(n, normalize(vec3(-.55, .45, .7))));
            gl_PointSize = clamp(size * 320.0 / -mv.z * (.75 + brightness * .6), 1.0, 5.0);
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: `uniform vec3 color; uniform float opacity; varying float brightness;
          void main() {
            float radius = length(gl_PointCoord - .5);
            if (radius > .5) discard;
            float alpha = (1.0 - smoothstep(.12, .5, radius)) * opacity * brightness;
            gl_FragColor = vec4(color, alpha);
          }`,
        transparent: true, depthWrite: false, blending: T.AdditiveBlending,
      })
      earth.add(new T.Points(geometry, material))
    }
    // Natural Earth 1:110m land, public domain. Coordinates sampled uniformly on a sphere.
    const land: number[] = []
    for (let i = 0; i < landCoordinates.length; i += 2) {
      land.push(...position(landCoordinates[i], landCoordinates[i + 1]).toArray())
    }
    points(land, 0xc4f1ff, .06, 1)
    const ocean: number[] = []
    const goldenAngle = Math.PI * (3 - Math.sqrt(5))
    for (let i = 0; i < 3400; i++) {
      const y = 1 - 2 * (i + .5) / 3400
      const r = Math.sqrt(1 - y * y)
      ocean.push(2 * r * Math.cos(i * goldenAngle), 2 * y, 2 * r * Math.sin(i * goldenAngle))
    }
    points(ocean, 0x2f78c8, .026, .5)

    const grid: number[] = []
    for (let lat = -60; lat <= 60; lat += 30) {
      for (let lon = -180; lon < 180; lon += 3) grid.push(...position(lon, lat).toArray(), ...position(lon + 3, lat).toArray())
    }
    for (let lon = -180; lon < 180; lon += 30) {
      for (let lat = -90; lat < 90; lat += 3) grid.push(...position(lon, lat).toArray(), ...position(lon, lat + 3).toArray())
    }
    const gridGeometry = new T.BufferGeometry()
    gridGeometry.setAttribute('position', new T.Float32BufferAttribute(grid, 3))
    earth.add(new T.LineSegments(gridGeometry, new T.LineBasicMaterial({ color: 0x4886c9, transparent: true, opacity: .1, depthWrite: false })))

    const atmosphere = new T.Mesh(new T.SphereGeometry(2.2, 64, 48), new T.ShaderMaterial({
      vertexShader: `varying vec3 normalView; varying vec3 viewPosition;
        void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); normalView = normalize(normalMatrix * normal); viewPosition = -mv.xyz; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `varying vec3 normalView; varying vec3 viewPosition;
        void main() { float rim = pow(1.0 - abs(dot(normalize(normalView), normalize(viewPosition))), 3.0); gl_FragColor = vec4(.22, .6, 1.0, rim * .85); }`,
      side: T.BackSide, transparent: true, depthWrite: false, blending: T.AdditiveBlending,
    }))
    earth.add(atmosphere)

    // Elevated great-circle connections between recognizable geographic locations.
    const cities = [[116.4, 39.9], [121.5, 31.2], [113.3, 23.1], [114.1, 22.3], [139.7, 35.7], [103.8, 1.35], [-122.4, 37.8], [-74, 40.7], [0, 51.5], [2.35, 48.9], [55.3, 25.2], [151.2, -33.9], [77.2, 28.6], [-46.6, -23.5]]
    points(cities.flatMap(([lon, lat]) => position(lon, lat, 2.02).toArray()), 0xfff3c4, .16, 1)
    const routes = [[116, 40, -122, 38], [116, 40, 2, 49], [139, 36, 151, -34], [-74, 41, 0, 51], [104, 1, 55, 25]]
    routes.forEach(([fromLon, fromLat, toLon, toLat], index) => {
      const start = position(fromLon, fromLat, 2.04)
      const end = position(toLon, toLat, 2.04)
      const vertices = Array.from({ length: 65 }, (_, i) => {
        const t = i / 64
        return start.clone().lerp(end, t).normalize().multiplyScalar(2.04 + Math.sin(t * Math.PI) * .4)
      })
      const curve = new T.CatmullRomCurve3(vertices)
      const geometry = new T.BufferGeometry().setFromPoints(vertices)
      earth.add(new T.Line(geometry, new T.LineBasicMaterial({ color: index % 2 ? 0x55c8d5 : 0x70a9ff, transparent: true, opacity: .6, depthWrite: false })))
      const dot = new T.Mesh(new T.SphereGeometry(.03, 10, 8), new T.MeshBasicMaterial({ color: 0xe6fbff }))
      dot.position.copy(curve.getPoint(index / routes.length))
      earth.add(dot)
      orbitDots.push({ dot, curve, offset: index / routes.length })
    })

    const renderFrame = (now: number) => {
      if (disposed || contextLost) return
      const delta = previous ? Math.min((now - previous) / 1000, .05) : 0
      previous = now
      elapsed += delta
      earth.rotation.y += delta * .065
      orbitDots.forEach(({ dot, curve, offset }) => dot.position.copy(curve.getPoint((elapsed * .08 + offset) % 1)))
      renderer.render(scene, camera)
      frame = requestAnimationFrame(renderFrame)
    }
    syncAnimation = () => {
      cancelAnimationFrame(frame)
      previous = 0
      if (disposed || contextLost) return
      renderer.render(scene, camera)
      if (!props.paused && !reducedMotion.matches && !document.hidden && visible) frame = requestAnimationFrame(renderFrame)
    }
    resizeObserver.observe(element)
    visibilityObserver.observe(element)
    reducedMotion.addEventListener('change', syncAnimation)
    document.addEventListener('visibilitychange', syncAnimation)
    renderer.domElement.addEventListener('webglcontextlost', lostContext)
    renderer.domElement.addEventListener('webglcontextrestored', restoredContext)
    resize()
    ready.value = true
    syncAnimation()
  } catch {
    stop()
    ready.value = false
  }
})

onBeforeUnmount(() => { disposed = true; stop() })
</script>

<style scoped>
.hero-globe { position: absolute; width: min(680px, 58vw); aspect-ratio: 1; left: 50%; top: 50%; transform: translate(-50%, -50%); pointer-events: none; z-index: 1; }
.hero-globe :deep(canvas) { position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; transition: opacity 1s; }
.hero-globe.is-ready :deep(canvas) { opacity: 1; }
.globe-fallback { position: absolute; inset: 12%; border-radius: 50%; border: 1px solid #72c9ff40; background: radial-gradient(circle at 30% 26%, #23619280, #08162b 56%, #030916 82%); box-shadow: inset -16px -10px 35px #020610, inset 4px 0 18px #68c5ff4d, 0 0 35px #3577ce26; transition: opacity .6s; }
.globe-fallback::after { content: ''; position: absolute; inset: 0; border-radius: inherit; background: repeating-linear-gradient(0deg, transparent 0 30px, #78bcff0f 31px 32px); }
.is-ready .globe-fallback { opacity: 0; }
@media (max-width: 960px) { .hero-globe { top: 150px; width: min(350px, 88vw); } }
@media (max-width: 760px) { .hero-globe { top: 145px; width: min(320px, 82vw); } }
@media (prefers-reduced-motion: reduce) { .hero-globe :deep(canvas), .globe-fallback { transition: none; } }
</style>
