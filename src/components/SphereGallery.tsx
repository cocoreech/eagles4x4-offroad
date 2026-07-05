'use client'

// SphereGallery — immersive build gallery: camera sits inside a sphere of
// build cards. Drag to look around (inertial easing), click a card to focus
// it and slide in a detail panel. Falls back to an accessible grid when
// WebGL is unavailable or the user prefers reduced motion.

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import * as THREE from 'three'
import gsap from 'gsap'

export interface GalleryBuild {
  slug: string
  title: string
  vehicle: string
  cover: string
  tags: string[]
}

type TileMesh = THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>

interface TileData {
  build: GalleryBuild
  lon: number
  lat: number
}

interface SceneApi {
  focus: (slug: string, instant?: boolean) => void
  unfocus: () => void
}

const SPHERE_RADIUS = 14
const TILE_W = 4.6
const TILE_H = 3.0
// Latitude bands (radians) and tiles per band — 48 tiles total
const ROWS: ReadonlyArray<{ lat: number; count: number }> = [
  { lat: -0.85, count: 8 },
  { lat: -0.42, count: 10 },
  { lat: 0, count: 12 },
  { lat: 0.42, count: 10 },
  { lat: 0.85, count: 8 },
]
const DRAG_SENS = 0.0032
const PITCH_CLAMP = 0.55
const IDLE_DELAY_MS = 3000
const IDLE_SPEED = 0.0007
// Helix twist: each band is rotated proportional to its latitude so the rows
// spiral rather than stack — our signature, not a clean phantom-style grid.
const HELIX_TWIST = 0.9
// Headlight sweep: tiles ignite near screen center, dim to embers at the edge.
const SWEEP_HOT = 1.18
const SWEEP_DIM = 0.34
// Dust kick: gold trail-dust burst thrown on drag release.
const KICK_COUNT = 90

function shortestAngle(from: number, to: number): number {
  return from + Math.atan2(Math.sin(to - from), Math.cos(to - from))
}

export default function SphereGallery({ builds }: Readonly<{ builds: GalleryBuild[] }>) {
  const [mode, setMode] = useState<'sphere' | 'grid'>('sphere')
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<GalleryBuild | null>(null)
  const [hinted, setHinted] = useState(false)

  const mountRef = useRef<HTMLDivElement>(null)
  const apiRef = useRef<SceneApi | null>(null)
  const closeBtnRef = useRef<HTMLButtonElement>(null)
  const bearingRef = useRef<HTMLSpanElement>(null)
  const cardinalRef = useRef<HTMLSpanElement>(null)
  const selectedRef = useRef<GalleryBuild | null>(null)
  selectedRef.current = selected

  // ── Reduced motion / WebGL detection → grid fallback ──
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setMode('grid')
      setLoading(false)
    }
  }, [])

  // URL sync uses replaceState only: shareable deep links without adding
  // history entries that fight the Next.js App Router's popstate handling.
  const openBuild = useCallback((build: GalleryBuild, viaHistory: boolean) => {
    setSelected(build)
    if (!viaHistory) {
      const url = new URL(window.location.href)
      url.searchParams.set('b', build.slug)
      window.history.replaceState(window.history.state, '', url)
    }
  }, [])

  const closeBuild = useCallback((viaHistory: boolean) => {
    setSelected(null)
    apiRef.current?.unfocus()
    if (!viaHistory) {
      const url = new URL(window.location.href)
      url.searchParams.delete('b')
      window.history.replaceState(window.history.state, '', url)
    }
  }, [])

  // ── History sync (back/forward closes or reopens the panel) ──
  useEffect(() => {
    const onPop = () => {
      const slug = new URLSearchParams(window.location.search).get('b')
      const build = builds.find(b => b.slug === slug)
      if (build) {
        apiRef.current?.focus(build.slug)
        openBuild(build, true)
      } else {
        setSelected(null)
        apiRef.current?.unfocus()
      }
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [builds, openBuild])

  // ── Escape closes the panel; focus moves to close button on open ──
  useEffect(() => {
    if (!selected) return
    closeBtnRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeBuild(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selected, closeBuild])

  // ── Three.js scene ──
  useEffect(() => {
    if (mode !== 'sphere') return
    const mount = mountRef.current
    if (!mount || builds.length === 0) return

    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
    } catch {
      setMode('grid')
      setLoading(false)
      return
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(mount.clientWidth, mount.clientHeight)
    renderer.domElement.style.touchAction = 'none'
    renderer.domElement.style.cursor = 'grab'
    mount.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#0A0A0A')

    const camera = new THREE.PerspectiveCamera(70, mount.clientWidth / mount.clientHeight, 0.1, 100)
    camera.rotation.order = 'YXZ'
    camera.position.set(0, 0, 0)

    const group = new THREE.Group()
    scene.add(group)

    // Dust particles for depth
    const dustCount = 350
    const dustPos = new Float32Array(dustCount * 3)
    for (let i = 0; i < dustCount; i++) {
      const r = 5 + Math.random() * 7
      const theta = Math.random() * Math.PI * 2
      const phi = (Math.random() - 0.5) * Math.PI
      dustPos[i * 3] = r * Math.cos(phi) * Math.sin(theta)
      dustPos[i * 3 + 1] = r * Math.sin(phi)
      dustPos[i * 3 + 2] = -r * Math.cos(phi) * Math.cos(theta)
    }
    const dustGeo = new THREE.BufferGeometry()
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3))
    const dustMat = new THREE.PointsMaterial({ color: 0xc9a84c, size: 0.04, transparent: true, opacity: 0.3 })
    const dust = new THREE.Points(dustGeo, dustMat)
    scene.add(dust)

    // Trail-dust kick — a burst thrown in front of the camera on drag release.
    const kickPos = new Float32Array(KICK_COUNT * 3)
    const kickVel = new Float32Array(KICK_COUNT * 3)
    const kickLife = new Float32Array(KICK_COUNT)
    const kickGeo = new THREE.BufferGeometry()
    kickGeo.setAttribute('position', new THREE.BufferAttribute(kickPos, 3))
    const kickMat = new THREE.PointsMaterial({
      color: 0xd8a850,
      size: 0.13,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    const kick = new THREE.Points(kickGeo, kickMat)
    scene.add(kick)

    const spawnKick = (speed: number) => {
      const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion)
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion)
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion)
      const origin = fwd.clone().multiplyScalar(7)
      const lateral = gsap.utils.clamp(-1, 1, rot.velYaw * 60)
      for (let i = 0; i < KICK_COUNT; i++) {
        const spread = 2.4
        const px = origin.x + (Math.random() - 0.5) * spread
        const py = origin.y + (Math.random() - 0.5) * spread
        const pz = origin.z + (Math.random() - 0.5) * spread
        kickPos[i * 3] = px
        kickPos[i * 3 + 1] = py
        kickPos[i * 3 + 2] = pz
        const mag = (0.04 + Math.random() * 0.06) * (0.5 + speed * 12)
        const dir = right.clone().multiplyScalar(-lateral)
          .add(up.clone().multiplyScalar((Math.random() - 0.4) * 0.6))
          .add(fwd.clone().multiplyScalar((Math.random() - 0.5) * 0.4))
          .normalize()
        kickVel[i * 3] = dir.x * mag
        kickVel[i * 3 + 1] = dir.y * mag
        kickVel[i * 3 + 2] = dir.z * mag
        kickLife[i] = 0.6 + Math.random() * 0.5
      }
    }

    // Tiles
    const manager = new THREE.LoadingManager(() => setLoading(false))
    const loader = new THREE.TextureLoader(manager)
    const textures = builds.map(b => {
      const t = loader.load(b.cover)
      t.colorSpace = THREE.SRGBColorSpace
      t.anisotropy = renderer.capabilities.getMaxAnisotropy()
      return t
    })

    const tiles: TileMesh[] = []
    const tileData = new Map<TileMesh, TileData>()
    const geo = new THREE.PlaneGeometry(TILE_W, TILE_H)
    let tileIndex = 0
    for (const row of ROWS) {
      const step = (Math.PI * 2) / row.count
      const offset = (tileIndex % 2) * step * 0.5
      for (let i = 0; i < row.count; i++) {
        // Spiral the azimuth by latitude so bands twist into a helix.
        const az = i * step + offset + row.lat * HELIX_TWIST
        const build = builds[tileIndex % builds.length]
        const mat = new THREE.MeshBasicMaterial({
          map: textures[tileIndex % builds.length],
          transparent: true,
          color: new THREE.Color(SWEEP_DIM, SWEEP_DIM, SWEEP_DIM),
        })
        const mesh: TileMesh = new THREE.Mesh(geo, mat)
        const cosLat = Math.cos(row.lat)
        mesh.position.set(
          SPHERE_RADIUS * cosLat * Math.sin(az),
          SPHERE_RADIUS * Math.sin(row.lat),
          -SPHERE_RADIUS * cosLat * Math.cos(az),
        )
        mesh.lookAt(0, 0, 0)
        mesh.rotateZ(row.lat * 0.18) // gentle bank reinforces the helix
        tileData.set(mesh, { build, lon: az, lat: row.lat })
        group.add(mesh)
        tiles.push(mesh)
        tileIndex++
      }
    }

    // ── Interaction state ──
    const rot = { yaw: 0, pitch: 0, yawT: 0, pitchT: 0, velYaw: 0, velPitch: 0 }
    let dragging = false
    let focused: TileMesh | null = null
    let hovered: TileMesh | null = null
    let downX = 0
    let downY = 0
    let prevX = 0
    let prevY = 0
    let moved = 0
    let lastInteract = performance.now()
    const pointer = new THREE.Vector2(-10, -10)
    const raycaster = new THREE.Raycaster()

    const setNDC = (e: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect()
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
    }

    const focusTile = (mesh: TileMesh, instant = false) => {
      const data = tileData.get(mesh)
      if (!data) return
      focused = mesh
      rot.velYaw = 0
      rot.velPitch = 0
      // Offset yaw so the focused tile sits left of the detail panel on desktop
      const focusFov = THREE.MathUtils.degToRad(38)
      const hfov = 2 * Math.atan(Math.tan(focusFov / 2) * camera.aspect)
      const panelFrac = window.innerWidth >= 768 ? 480 / window.innerWidth : 0
      const yawTo = shortestAngle(rot.yawT, data.lon) + (hfov / 2) * panelFrac
      const dur = instant ? 0 : 1.3
      gsap.to(rot, { yawT: yawTo, pitchT: data.lat, duration: dur, ease: 'power3.inOut' })
      gsap.to(camera, {
        fov: 38,
        duration: dur,
        ease: 'power3.inOut',
        onUpdate: () => camera.updateProjectionMatrix(),
      })
      for (const t of tiles) {
        gsap.to(t.material, { opacity: t === mesh ? 1 : 0.12, duration: instant ? 0 : 0.9, ease: 'power2.out' })
      }
      gsap.to(mesh.material.color, { r: 1, g: 1, b: 1, duration: instant ? 0 : 0.6 })
    }

    const unfocusTile = () => {
      if (!focused) return
      const prev = focused
      focused = null
      gsap.to(camera, {
        fov: 70,
        duration: 1.1,
        ease: 'power3.inOut',
        onUpdate: () => camera.updateProjectionMatrix(),
      })
      gsap.to(rot, { pitchT: gsap.utils.clamp(-PITCH_CLAMP, PITCH_CLAMP, rot.pitchT), duration: 1.1, ease: 'power3.inOut' })
      for (const t of tiles) {
        gsap.to(t.material, { opacity: 1, duration: 0.9, ease: 'power2.out' })
      }
      void prev // brightness handed back to the headlight-sweep loop
    }

    apiRef.current = {
      focus: (slug, instant) => {
        const mesh = tiles.find(t => tileData.get(t)?.build.slug === slug)
        if (mesh) focusTile(mesh, instant)
      },
      unfocus: unfocusTile,
    }

    const onDown = (e: PointerEvent) => {
      if (focused) return
      dragging = true
      moved = 0
      downX = prevX = e.clientX
      downY = prevY = e.clientY
      lastInteract = performance.now()
      renderer.domElement.setPointerCapture(e.pointerId)
      renderer.domElement.style.cursor = 'grabbing'
      setHinted(true)
    }
    const onMove = (e: PointerEvent) => {
      setNDC(e)
      if (!dragging) return
      const dx = e.clientX - prevX
      const dy = e.clientY - prevY
      prevX = e.clientX
      prevY = e.clientY
      moved = Math.max(moved, Math.hypot(e.clientX - downX, e.clientY - downY))
      rot.yawT -= dx * DRAG_SENS
      rot.pitchT = gsap.utils.clamp(-PITCH_CLAMP, PITCH_CLAMP, rot.pitchT + dy * DRAG_SENS)
      rot.velYaw = -dx * DRAG_SENS
      rot.velPitch = dy * DRAG_SENS
      lastInteract = performance.now()
    }
    const onUp = (e: PointerEvent) => {
      renderer.domElement.style.cursor = hovered ? 'pointer' : 'grab'
      if (!dragging) return
      dragging = false
      lastInteract = performance.now()
      const releaseSpeed = Math.abs(rot.velYaw) + Math.abs(rot.velPitch)
      if (moved >= 7 && releaseSpeed > 0.004) spawnKick(releaseSpeed)
      if (moved < 7 && !focused && !selectedRef.current) {
        setNDC(e)
        raycaster.setFromCamera(pointer, camera)
        const hit = raycaster.intersectObjects(tiles, false)[0]
        if (hit) {
          const mesh = hit.object as TileMesh
          const data = tileData.get(mesh)
          if (data) {
            focusTile(mesh)
            openBuild(data.build, false)
          }
        }
      }
    }

    renderer.domElement.addEventListener('pointerdown', onDown)
    renderer.domElement.addEventListener('pointermove', onMove)
    renderer.domElement.addEventListener('pointerup', onUp)

    const onResize = () => {
      camera.aspect = mount.clientWidth / mount.clientHeight
      camera.updateProjectionMatrix()
      renderer.setSize(mount.clientWidth, mount.clientHeight)
    }
    window.addEventListener('resize', onResize)

    // Deep link: open panel + snap focus once scene exists
    const initialSlug = new URLSearchParams(window.location.search).get('b')
    if (initialSlug) {
      const build = builds.find(b => b.slug === initialSlug)
      if (build) {
        apiRef.current.focus(build.slug, true)
        setSelected(build)
      }
    }

    // ── Render loop: lenis-style chase + inertia + idle drift ──
    let raf = 0
    let frame = 0
    const camFwd = new THREE.Vector3()
    const tileWorld = new THREE.Vector3()
    const tileDir = new THREE.Vector3()
    const tick = () => {
      raf = requestAnimationFrame(tick)
      if (!dragging && !focused) {
        rot.yawT += rot.velYaw
        rot.pitchT = gsap.utils.clamp(-PITCH_CLAMP, PITCH_CLAMP, rot.pitchT + rot.velPitch)
        rot.velYaw *= 0.94
        rot.velPitch *= 0.94
        if (performance.now() - lastInteract > IDLE_DELAY_MS) rot.yawT += IDLE_SPEED
      }
      rot.yaw += (rot.yawT - rot.yaw) * 0.075
      rot.pitch += (rot.pitchT - rot.pitch) * 0.075
      group.rotation.y = rot.yaw
      camera.rotation.x = rot.pitch
      dust.rotation.y += 0.0003

      // Hover pick (skip while dragging or focused) — scale only; the sweep owns colour.
      if (!dragging && !focused) {
        raycaster.setFromCamera(pointer, camera)
        const hit = raycaster.intersectObjects(tiles, false)[0]
        const mesh = hit ? (hit.object as TileMesh) : null
        if (mesh !== hovered) {
          if (hovered) gsap.to(hovered.scale, { x: 1, y: 1, z: 1, duration: 0.4, ease: 'power2.out' })
          hovered = mesh
          if (hovered) gsap.to(hovered.scale, { x: 1.07, y: 1.07, z: 1.07, duration: 0.4, ease: 'power2.out' })
          renderer.domElement.style.cursor = hovered ? 'pointer' : 'grab'
        }
      }

      // Headlight sweep — brightness ramps as a tile crosses the camera's gaze.
      if (!focused) {
        camera.getWorldDirection(camFwd)
        for (const t of tiles) {
          t.getWorldPosition(tileWorld)
          tileDir.copy(tileWorld).normalize()
          const aim = gsap.utils.clamp(0, 1, (tileDir.dot(camFwd) - 0.55) / 0.45)
          let b = SWEEP_DIM + (SWEEP_HOT - SWEEP_DIM) * aim * aim
          if (t === hovered) b = Math.max(b, 1)
          t.material.color.setScalar(b)
        }
      }

      // Trail-dust kick physics.
      if (kickMat.opacity > 0.001 || kickLife.some(l => l > 0)) {
        let maxLife = 0
        for (let i = 0; i < KICK_COUNT; i++) {
          if (kickLife[i] <= 0) continue
          kickLife[i] -= 0.016
          kickVel[i * 3 + 1] -= 0.0008 // settle downward like real dust
          kickPos[i * 3] += kickVel[i * 3]
          kickPos[i * 3 + 1] += kickVel[i * 3 + 1]
          kickPos[i * 3 + 2] += kickVel[i * 3 + 2]
          if (kickLife[i] > maxLife) maxLife = kickLife[i]
        }
        kickGeo.attributes.position.needsUpdate = true
        kickMat.opacity = gsap.utils.clamp(0, 0.7, maxLife)
      }

      // Bearing HUD — ticks as the world spins (ref writes, no React re-render).
      if ((frame & 3) === 0 && bearingRef.current) {
        const deg = ((-rot.yaw * 180) / Math.PI % 360 + 360) % 360
        bearingRef.current.textContent = `${Math.round(deg).toString().padStart(3, '0')}°`
        if (cardinalRef.current) {
          const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
          cardinalRef.current.textContent = dirs[Math.round(deg / 45) % 8]
        }
      }
      frame++

      renderer.render(scene, camera)
    }
    tick()

    return () => {
      cancelAnimationFrame(raf)
      apiRef.current = null
      window.removeEventListener('resize', onResize)
      renderer.domElement.removeEventListener('pointerdown', onDown)
      renderer.domElement.removeEventListener('pointermove', onMove)
      renderer.domElement.removeEventListener('pointerup', onUp)
      gsap.killTweensOf(rot)
      gsap.killTweensOf(camera)
      for (const t of tiles) {
        gsap.killTweensOf(t.material)
        gsap.killTweensOf(t.material.color)
        gsap.killTweensOf(t.scale)
        t.material.dispose()
      }
      geo.dispose()
      dustGeo.dispose()
      dustMat.dispose()
      kickGeo.dispose()
      kickMat.dispose()
      for (const t of textures) t.dispose()
      renderer.dispose()
      mount.removeChild(renderer.domElement)
    }
  }, [mode, builds, openBuild])

  return (
    <main className="relative w-full overflow-hidden" style={{ height: '100vh', background: '#0A0A0A' }}>
      {/* WebGL mount */}
      {mode === 'sphere' && <div ref={mountRef} className="absolute inset-0" aria-hidden="true" />}

      {/* Vignette */}
      {mode === 'sphere' && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at center, transparent 55%, rgba(10,10,10,0.75) 100%)' }}
        />
      )}

      {/* Heading overlay */}
      <div className="absolute top-24 left-6 md:left-12 pointer-events-none" style={{ zIndex: 10 }}>
        <span className="inline-flex items-center gap-3 mb-3">
          <span className="w-8 h-px" style={{ background: 'var(--color-accent)' }} />
          <span className="text-[10px] font-semibold uppercase" style={{ letterSpacing: '0.25em', color: 'var(--color-accent)' }}>
            Portfolio
          </span>
        </span>
        <h1
          className="font-display font-black leading-none text-white"
          style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(40px, 5vw, 72px)' }}
        >
          Our <em style={{ color: 'var(--color-accent)', fontStyle: 'italic' }}>builds.</em>
        </h1>
      </div>

      {/* View toggle — keyboard-reachable path to the accessible grid */}
      <div className="absolute top-24 right-6 md:right-12 flex gap-2" style={{ zIndex: 10 }}>
        {(['sphere', 'grid'] as const).map(m => (
          <button
            key={m}
            onClick={() => setMode(m)}
            aria-pressed={mode === m}
            className="px-4 py-2 text-[10px] font-bold uppercase rounded-sm transition-all focus-visible:outline focus-visible:outline-2"
            style={{
              letterSpacing: '0.15em',
              background: mode === m ? 'var(--color-accent)' : 'rgba(20,20,20,0.8)',
              color: mode === m ? '#000' : 'rgba(245,245,245,0.6)',
              border: '1px solid rgba(201,168,76,0.25)',
              outlineColor: 'var(--color-accent)',
            }}
          >
            {m === 'sphere' ? '◉ Sphere' : '☰ List'}
          </button>
        ))}
      </div>

      {/* Drag hint */}
      {mode === 'sphere' && !hinted && !loading && (
        <div
          className="absolute bottom-20 left-1/2 -translate-x-1/2 pointer-events-none text-[10px] font-semibold uppercase"
          style={{ zIndex: 10, letterSpacing: '0.3em', color: 'rgba(245,245,245,0.45)', animation: 'sg-pulse 2.4s ease-in-out infinite' }}
        >
          ⟵ Drag to explore ⟶
        </div>
      )}

      {/* Bearing HUD — compass readout that ticks as you rotate */}
      {mode === 'sphere' && !loading && (
        <div
          className="absolute bottom-8 left-1/2 -translate-x-1/2 pointer-events-none flex items-center gap-3"
          style={{ zIndex: 10 }}
          aria-hidden="true"
        >
          <span className="w-12 h-px" style={{ background: 'linear-gradient(to right, transparent, rgba(201,168,76,0.5))' }} />
          <span
            ref={bearingRef}
            className="font-display font-black tabular-nums"
            style={{ fontFamily: 'var(--font-display)', fontSize: '15px', color: 'var(--color-accent)', letterSpacing: '0.08em', minWidth: '52px', textAlign: 'center' }}
          >
            000°
          </span>
          <span
            ref={cardinalRef}
            className="text-[10px] font-bold uppercase"
            style={{ letterSpacing: '0.3em', color: 'rgba(245,245,245,0.55)', minWidth: '24px' }}
          >
            N
          </span>
          <span className="w-12 h-px" style={{ background: 'linear-gradient(to left, transparent, rgba(201,168,76,0.5))' }} />
        </div>
      )}

      {/* Loading veil */}
      {mode === 'sphere' && loading && (
        <div className="absolute inset-0 flex items-center justify-center" style={{ zIndex: 20, background: '#0A0A0A' }}>
          <span className="text-[10px] font-semibold uppercase" style={{ letterSpacing: '0.3em', color: 'var(--color-accent)' }}>
            Loading builds…
          </span>
        </div>
      )}

      {/* Grid fallback */}
      {mode === 'grid' && (
        <div className="absolute inset-0 overflow-y-auto pt-48 px-6 md:px-12 pb-16">
          <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {builds.map(b => (
              <a
                key={b.slug}
                href={`/builds/${b.slug}`}
                onClick={(e) => { e.preventDefault(); openBuild(b, false) }}
                className="block text-left overflow-hidden rounded-sm transition-transform hover:scale-[1.02] focus-visible:outline focus-visible:outline-2"
                style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', outlineColor: 'var(--color-accent)' }}
              >
                <div className="aspect-[16/10] overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={b.cover} alt={b.title} className="w-full h-full object-cover" style={{ filter: 'brightness(0.85)' }} />
                </div>
                <div className="p-5">
                  <div className="text-[9px] font-bold uppercase mb-2" style={{ color: 'var(--color-accent)', letterSpacing: '0.25em' }}>
                    {b.vehicle}
                  </div>
                  <h3 className="font-display font-bold text-lg" style={{ fontFamily: 'var(--font-display)' }}>{b.title}</h3>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Detail panel */}
      {selected && (
        <div className="absolute inset-0" style={{ zIndex: 30 }}>
          <button
            className="absolute inset-0 w-full"
            style={{ background: 'rgba(10,10,10,0.35)', cursor: 'default' }}
            onClick={() => closeBuild(false)}
            aria-label="Close build details"
            tabIndex={-1}
          />
          <aside
            role="dialog"
            aria-modal="true"
            aria-label={selected.title}
            className="absolute right-0 top-0 h-full w-full md:w-[480px] flex flex-col overflow-y-auto"
            style={{
              background: 'rgba(16,16,16,0.96)',
              backdropFilter: 'blur(16px)',
              borderLeft: '1px solid rgba(201,168,76,0.2)',
              animation: 'sg-slide-in 0.6s cubic-bezier(0.22, 1, 0.36, 1) both',
            }}
          >
            <div className="aspect-[16/10] flex-shrink-0 overflow-hidden relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={selected.cover} alt={selected.title} className="w-full h-full object-cover" />
              <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(16,16,16,1) 0%, transparent 40%)' }} />
            </div>
            <div className="p-8 flex-1">
              <div className="text-[10px] font-bold uppercase mb-3" style={{ color: 'var(--color-accent)', letterSpacing: '0.25em' }}>
                {selected.vehicle}
              </div>
              <h2
                className="font-display font-black leading-tight mb-5 text-white"
                style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(26px, 3vw, 36px)' }}
              >
                {selected.title}
              </h2>
              <div className="flex flex-wrap gap-1.5 mb-7">
                {selected.tags.map(t => (
                  <span
                    key={t}
                    className="text-[9px] font-bold uppercase px-2.5 py-1 rounded-sm"
                    style={{ letterSpacing: '0.1em', background: 'rgba(201,168,76,0.1)', color: 'rgba(201,168,76,0.75)' }}
                  >
                    {t}
                  </span>
                ))}
              </div>
              <p className="text-sm mb-10" style={{ color: 'rgba(245,245,245,0.55)', lineHeight: 1.75 }}>
                Built in-house at our Dasmariñas shop — every component selected,
                fitted, and tested by our own team. Full parts list and progress
                photos for this build are coming soon.
              </p>
              <div className="flex gap-3">
                <Link
                  href="/bookings/new"
                  className="px-6 py-3.5 text-[10px] font-extrabold uppercase rounded-sm transition-all hover:brightness-110"
                  style={{ background: 'var(--color-accent)', color: '#000', letterSpacing: '0.12em' }}
                >
                  Book this setup
                </Link>
                <Link
                  href="/services"
                  className="px-6 py-3.5 text-[10px] font-semibold uppercase rounded-sm"
                  style={{ color: 'rgba(245,245,245,0.6)', letterSpacing: '0.12em', border: '1px solid rgba(245,245,245,0.15)' }}
                >
                  Get a quote
                </Link>
              </div>
            </div>
            <button
              ref={closeBtnRef}
              onClick={() => closeBuild(false)}
              aria-label="Close build details"
              className="absolute top-20 right-4 w-10 h-10 rounded-full flex items-center justify-center text-lg transition-all hover:rotate-90 focus-visible:outline focus-visible:outline-2"
              style={{
                background: 'rgba(10,10,10,0.6)',
                color: 'rgba(245,245,245,0.8)',
                border: '1px solid rgba(245,245,245,0.2)',
                outlineColor: 'var(--color-accent)',
              }}
            >
              ✕
            </button>
          </aside>
        </div>
      )}

      <style>{`
        @keyframes sg-slide-in { 0% { transform: translateX(100%); } 100% { transform: translateX(0); } }
        @keyframes sg-pulse { 0%, 100% { opacity: 0.35; } 50% { opacity: 0.8; } }
      `}</style>
    </main>
  )
}
