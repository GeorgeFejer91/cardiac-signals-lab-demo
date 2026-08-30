# Reused social-avatar face assets

The seven files under `spherical/` are copied from the project-authored facial-expression library in `GeorgeFejer91/minimal-social-threat-webxr` and remain covered by that repository's MIT license. They are transparent 2:1 equirectangular SVG maps aligned to the procedural head's forward axis.

The current WebGL widgets use the same canonical cubic-Bézier geometry from the reused `app/facial-expression.ts`, tessellating the features directly onto the orb surface and morphing continuously between expressions. The SVG files remain auditable standalone endpoints of that geometry. These are evidence-grounded design prototypes, not normed or independently validated emotion stimuli. The two older root-level planar SVG files are retained only for source compatibility.
