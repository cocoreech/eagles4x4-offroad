# WebGL sphere gallery for the /builds portfolio

The `/builds` page renders an immersive spherical gallery (vanilla Three.js + GSAP, no react-three-fiber) where the visitor sits inside a sphere of build cards and drags to look around. We chose this over a conventional card grid because the portfolio is the primary brand-differentiation surface for a premium 4×4 shop, and an interactive showpiece earns attention that a grid does not.

## Status

accepted

## Consequences

- **Bundle budget is knowingly exceeded on this route.** `three` (~160kb gz) alone blows past the project's 150kb page-JS budget (see CLAUDE.md › Performance). The waiver is scoped to `/builds` only — the heavy WebGL bundle is kept off the landing page, which keeps a lightweight carousel teaser instead.
- **Accessibility is preserved via a parallel path, not the canvas.** WebGL is unreachable by keyboard and screen readers, so the component ships an accessible List view (real `<button>` cards) that is the default for `prefers-reduced-motion` and no-WebGL clients, and is reachable by everyone through an in-page Sphere/List toggle. Sphere is the default for capable clients.
- **Card detail is an in-canvas overlay, not route navigation.** Tapping a card animates the camera and slides in a panel; the URL syncs to `?b=<slug>` via `replaceState` for shareable deep links. A real Next.js navigation would unmount the WebGL scene and kill the transition. Trade-off: browser Back exits the gallery rather than closing the panel.

## Considered options

- **Plain responsive card grid** — within budget and fully accessible, but visually generic; rejected as the primary experience (it survives as the List fallback).
- **`@react-three/fiber` + drei** — declarative scene graph, but adds ~40kb and a reconciler layer that fights GSAP-driven render-loop choreography; rejected for a bundle and control-flow cost we didn't need.

## Note on originality

The interaction pattern was inspired by a reference site. Interaction patterns and ideas are not copyrightable, and our implementation, assets, and copy are original — but to put distance between the two and reduce even nuisance-complaint risk, the gallery carries distinct touches (helix-twisted bands, a headlight-sweep brightness model, a trail-dust release burst, and a compass bearing HUD) that have no counterpart in the reference.
