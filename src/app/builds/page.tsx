// /builds — public gallery. Immersive spherical build gallery (Three.js +
// GSAP) with an accessible list view. Visitors choose Sphere (default) or
// List via the in-page toggle; reduced-motion / no-WebGL clients get List.

import { createClient } from '@/utils/supabase/server'
import PublicNav from '@/components/PublicNav'
import SphereGallery, { type GalleryBuild } from '@/components/SphereGallery'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Our Builds — Eagles 4×4 Offroad',
  description: 'Explore our completed 4×4 builds — lift kits, suspension overhauls, and full transformations, all done in-house in Dasmariñas, Cavite.',
}

const HARDCODED_BUILDS: GalleryBuild[] = [
  { slug: 'hilux-full-build',  title: '4" Lift + ARB Bull Bar Setup',  vehicle: 'Toyota Hilux · 2024',   cover: '/images/build-01.jpg', tags: ['Lift Kit', 'Suspension', 'Bull Bar', 'Winch'] },
  { slug: 'ranger-bullbar',    title: 'Bull Bar + Winch Combo',        vehicle: 'Ford Ranger · 2023',    cover: '/images/build-02.jpg', tags: ['Bull Bar', 'Winch'] },
  { slug: 'strada-suspension', title: 'Complete Suspension Overhaul',  vehicle: 'Mitsubishi Strada',     cover: '/images/build-03.jpg', tags: ['Suspension', 'Lift'] },
  { slug: 'fortuner-wheels',   title: 'OX Wheels + KO2 Tire Setup',    vehicle: 'Toyota Fortuner',       cover: '/images/build-04.jpg', tags: ['Wheels', 'Tires'] },
  { slug: 'dmax-protection',   title: 'Lift Kit + Skid Plate Armor',   vehicle: 'Isuzu D-Max · 2023',    cover: '/images/build-05.jpg', tags: ['Lift Kit', 'Protection'] },
  { slug: 'navara-exterior',   title: 'Full Exterior Transformation',  vehicle: 'Nissan Navara · 2024',  cover: '/images/build-06.jpg', tags: ['Bull Bar', 'Lighting', 'Rack'] },
]

export default async function BuildsPage() {
  const supabase = await createClient()
  const { data: dbBuilds } = await supabase
    .from('builds')
    .select('slug, title, vehicle_make, vehicle_model, vehicle_year, cover_image_url, tags')
    .order('is_featured', { ascending: false })
    .order('build_date', { ascending: false })
    .limit(24)

  const useDbBuilds = (dbBuilds?.length ?? 0) >= 3
  const builds: GalleryBuild[] = useDbBuilds
    ? (dbBuilds ?? []).map(b => ({
        slug:    b.slug,
        title:   b.title,
        vehicle: `${b.vehicle_make} ${b.vehicle_model}${b.vehicle_year ? ` · ${b.vehicle_year}` : ''}`.trim(),
        cover:   b.cover_image_url ?? '/images/build-01.jpg',
        tags:    Array.isArray(b.tags) ? b.tags.slice(0, 4) : [],
      }))
    : HARDCODED_BUILDS

  return (
    <>
      <PublicNav />
      <SphereGallery builds={builds} />
    </>
  )
}
