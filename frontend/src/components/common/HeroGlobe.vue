<template>
  <div ref="host" class="hero-globe" :class="{ 'is-ready': ready }" aria-hidden="true">
    <div class="globe-fallback"></div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type * as THREE from 'three'
import dayUrl from '@/assets/earth/earth_atmos_2048.jpg'
import nightUrl from '@/assets/earth/earth_lights_2048.png'
import specUrl from '@/assets/earth/earth_specular_2048.jpg'
import cloudUrl from '@/assets/earth/earth_clouds_1024.png'

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
    earth.rotation.set(.1, -3.55, -.1)
    scene.add(earth)

    let frame = 0
    let visible = true
    let contextLost = false
    let previous = 0
    let elapsed = 0
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const textures: THREE.Texture[] = []
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
      textures.forEach(texture => texture.dispose())
      renderer.dispose()
      renderer.domElement.remove()
    }
    stop = release

    const lightDir = new T.Vector3(-.22, .2, .96).normalize()
    scene.add(new T.AmbientLight(0x709cce, 1.2))
    const sun = new T.DirectionalLight(0xffffff, 2)
    sun.position.copy(lightDir).multiplyScalar(6)
    scene.add(sun)

    const loader = new T.TextureLoader()
    const maxAniso = renderer.capabilities.getMaxAnisotropy()
    const load = (url: string) => new Promise<THREE.Texture>((resolve, reject) => {
      loader.load(url, (texture) => { texture.anisotropy = maxAniso; resolve(texture) }, undefined, reject)
    })
    const [dayMap, nightMap, specMap, cloudMap] = await Promise.all([load(dayUrl), load(nightUrl), load(specUrl), load(cloudUrl)])
    if (disposed) return
    ;[dayMap, nightMap, specMap, cloudMap].forEach(texture => { textures.push(texture) })

    const globe = new T.Mesh(new T.SphereGeometry(2, 96, 64), new T.ShaderMaterial({
      uniforms: { dayMap: { value: dayMap }, nightMap: { value: nightMap }, specMap: { value: specMap }, lightDir: { value: lightDir } },
      vertexShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vV;
        void main() {
          vUv = uv;
          vN = normalize(mat3(modelMatrix) * normal);
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vV = normalize(cameraPosition - wp.xyz);
          gl_Position = projectionMatrix * viewMatrix * wp;
        }`,
      fragmentShader: `uniform sampler2D dayMap; uniform sampler2D nightMap; uniform sampler2D specMap; uniform vec3 lightDir;
        varying vec2 vUv; varying vec3 vN; varying vec3 vV;
        void main() {
          vec3 n = normalize(vN);
          float ndl = dot(n, lightDir);
          float day = smoothstep(-.12, .3, ndl);
          vec3 d = texture2D(dayMap, vUv).rgb;
          vec3 lit = d * (.2 + 1.3 * max(ndl, 0.0));
          vec3 night = texture2D(nightMap, vUv).rgb * vec3(1.5, 1.2, .75);
          vec3 col = mix(night * 1.1 + d * vec3(.015, .03, .07), lit, day);
          float twilight = smoothstep(-.1, .0, ndl) * (1.0 - smoothstep(.0, .2, ndl));
          col += vec3(.9, .45, .2) * twilight * .12;
          float spec = texture2D(specMap, vUv).r;
          vec3 h = normalize(lightDir + vV);
          col += vec3(.75, .88, 1.0) * pow(max(dot(n, h), 0.0), 55.0) * spec * 1.1 * day;
          float rim = pow(1.0 - max(dot(n, vV), 0.0), 3.0);
          col += vec3(.2, .5, 1.0) * rim * .55 * (.35 + .65 * day);
          gl_FragColor = vec4(col, 1.0);
        }`,
    }))
    earth.add(globe)

    const clouds = new T.Mesh(new T.SphereGeometry(2.03, 96, 64), new T.ShaderMaterial({
      uniforms: { cloudMap: { value: cloudMap }, lightDir: { value: lightDir } },
      vertexShader: `varying vec2 vUv; varying vec3 vN;
        void main() { vUv = uv; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `uniform sampler2D cloudMap; uniform vec3 lightDir; varying vec2 vUv; varying vec3 vN;
        void main() {
          vec4 c = texture2D(cloudMap, vUv);
          float a = c.r * c.a;
          float l = smoothstep(-.15, .4, dot(normalize(vN), lightDir));
          gl_FragColor = vec4(vec3(.95, .97, 1.0) * (.06 + .94 * l), a * .55 * (.15 + .85 * l));
        }`,
      transparent: true, depthWrite: false,
    }))
    earth.add(clouds)

    const position = (lon: number, lat: number, radius = 2.005) => {
      const longitude = lon * Math.PI / 180
      const latitude = lat * Math.PI / 180
      return new T.Vector3(radius * Math.cos(latitude) * Math.cos(longitude), radius * Math.sin(latitude), -radius * Math.cos(latitude) * Math.sin(longitude))
    }
    const atmosphere = new T.Mesh(new T.SphereGeometry(2.2, 64, 48), new T.ShaderMaterial({
      vertexShader: `varying vec3 normalView; varying vec3 viewPosition;
        void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); normalView = normalize(normalMatrix * normal); viewPosition = -mv.xyz; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `varying vec3 normalView; varying vec3 viewPosition;
        void main() { float rim = pow(1.0 - abs(dot(normalize(normalView), normalize(viewPosition))), 3.0); gl_FragColor = vec4(.22, .6, 1.0, rim * .85); }`,
      side: T.BackSide, transparent: true, depthWrite: false, blending: T.AdditiveBlending,
    }))
    earth.add(atmosphere)

    // Elevated great-circle connections between recognizable geographic locations.
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
      clouds.rotation.y += delta * .012
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
