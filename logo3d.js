import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'

// Drop the Meshy export at assets/logo.glb. If it is missing, a built-in 3D emblem is used.
const GLB_PATH = 'assets/logo.glb'
const INTRO = 2.6
const stage = document.getElementById('logo-stage')
const canvas = document.getElementById('logo-canvas')
const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
const outBack = x => { const c = 1.70158; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2) }
const outQuart = x => 1 - Math.pow(1 - x, 4)

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
renderer.outputEncoding = THREE.sRGBEncoding
const scene = new THREE.Scene()
const cam = new THREE.PerspectiveCamera(35, 1, 0.1, 100)
cam.position.set(0, 0, 10)
scene.add(new THREE.AmbientLight(0x7fa8d8, 0.9))
const key = new THREE.DirectionalLight(0xffffff, 1.3); key.position.set(3, 4, 6); scene.add(key)
const blue = new THREE.PointLight(0x0090e9, 2.2, 0); blue.position.set(-5, -2, 4); scene.add(blue)
const deep = new THREE.PointLight(0x0e3dd8, 2.2, 0); deep.position.set(5, 3, -2); scene.add(deep)

const root = new THREE.Group(); scene.add(root)      // intro + idle motion
const model = new THREE.Group(); root.add(model)
const ring = new THREE.Group(); root.add(ring)       // orbit ring that assembles after the landing
const shock = new THREE.Mesh(
  new THREE.RingGeometry(1, 1.05, 128),
  new THREE.MeshBasicMaterial({ color: 0x0090e9, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })
)
scene.add(shock)

function buildEmblem() {
  const tex = new THREE.TextureLoader().load('logo.jpg'); tex.encoding = THREE.sRGBEncoding
  const face = new THREE.MeshStandardMaterial({ map: tex, metalness: 0.25, roughness: 0.4, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.22 })
  const metal = new THREE.MeshStandardMaterial({ color: 0x0a1f45, metalness: 0.9, roughness: 0.25 })
  const g = new THREE.Group()
  const front = new THREE.Mesh(new THREE.CircleGeometry(2, 96), face); front.position.z = 0.16
  const back = new THREE.Mesh(new THREE.CircleGeometry(2, 96), face); back.position.z = -0.16; back.rotation.y = Math.PI
  const side = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 0.32, 96, 1, true), metal); side.rotation.x = Math.PI / 2
  const rim = new THREE.Mesh(new THREE.TorusGeometry(2.02, 0.09, 24, 128), new THREE.MeshStandardMaterial({ color: 0x0090e9, emissive: 0x0090e9, emissiveIntensity: 0.9, metalness: 0.6, roughness: 0.3 }))
  g.add(front, back, side, rim)
  return g
}

function buildRing() {
  const m = new THREE.MeshBasicMaterial({ color: 0x0090e9, transparent: true, opacity: 0.55 })
  ring.add(new THREE.Mesh(new THREE.TorusGeometry(2.7, 0.012, 8, 160), m))
  for (let i = 0; i < 4; i++) {         // four nodes = the four gears of the logo
    const n = new THREE.Mesh(new THREE.IcosahedronGeometry(0.11, 1), new THREE.MeshBasicMaterial({ color: 0x6fd0ff }))
    n.userData.a = i * Math.PI / 2
    ring.add(n)
  }
  ring.rotation.x = 1.1
}

let ready = false, t0 = 0
function start(obj) { model.add(obj); buildRing(); ready = true; t0 = performance.now() / 1000 }

new GLTFLoader().load(GLB_PATH, gltf => {
  const o = gltf.scene, box = new THREE.Box3().setFromObject(o)
  const size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3())
  o.position.sub(c)
  const w = new THREE.Group(); w.add(o); w.scale.setScalar(4 / Math.max(size.x, size.y, size.z))
  const holder = new THREE.Group(); holder.add(w); start(holder)
}, undefined, () => start(buildEmblem()))

function resize() {
  const w = stage.clientWidth, h = stage.clientHeight
  renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix()
}
new ResizeObserver(resize).observe(stage); resize()

const mouse = { x: 0, y: 0, sx: 0, sy: 0 }
addEventListener('mousemove', e => { mouse.x = e.clientX / innerWidth * 2 - 1; mouse.y = e.clientY / innerHeight * 2 - 1 }, { passive: true })

let landed = false
function loop() {
  requestAnimationFrame(loop)
  if (!ready) return
  const t = performance.now() / 1000 - t0
  const k = clamp(t / INTRO, 0, 1), e = outQuart(k)

  // Intro: fly in from the depth while spinning, decelerate, pop to full size.
  root.position.z = -16 * (1 - e)
  root.scale.setScalar(Math.max(0.001, 0.25 + 0.75 * outBack(clamp(k * 1.05, 0, 1))))
  const spin = (1 - e) * Math.PI * 8
  mouse.sx += (mouse.x - mouse.sx) * 0.05; mouse.sy += (mouse.y - mouse.sy) * 0.05
  const idle = k >= 1 ? Math.sin(t * 0.6) * 0.3 : 0
  model.rotation.y = spin + idle + mouse.sx * 0.45
  model.rotation.x = mouse.sy * 0.25
  root.position.y = k >= 1 ? Math.sin(t * 1.1) * 0.08 : 0

  // Orbit ring assembles after landing.
  const rk = clamp((t - 1.3) / 1.2, 0, 1)
  ring.scale.setScalar(outBack(rk) || 0.001)
  ring.rotation.z = t * 0.5
  ring.children.forEach(n => { if (n.userData.a !== undefined) n.position.set(Math.cos(n.userData.a + t * 0.9) * 2.7, Math.sin(n.userData.a + t * 0.9) * 2.7, 0) })

  // Shockwave on landing.
  const sk = clamp((t - INTRO * 0.85) / 1.3, 0, 1)
  shock.scale.setScalar(1 + sk * 3.2); shock.material.opacity = sk > 0 && sk < 1 ? (1 - sk) * 0.8 : 0

  if (!landed && t > INTRO * 0.8) { landed = true; document.body.classList.add('landed') }
  renderer.render(scene, cam)
}
loop()
