"""Build the final VidNotes logo masters ("Intervals": note lines that grow like review intervals,
ending in a playhead).

Usage (needs shapely + fonttools[woff2]):
    python brand/build_logo.py

Writes brand/logo/*.svg. Geometry is constructed, then every corner is drawn as a true arc.
Wordmark: Roboto Bold (Apache-2.0) converted to outlines; the dot of the "i" is replaced by a
circle that echoes the playhead.
"""
import math
import os

from shapely import affinity
from shapely.geometry import Point, Polygon, box
from shapely.geometry.polygon import orient

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "logo")
FONT = os.path.join(ROOT, "..", "node_modules", "@fontsource-variable", "roboto", "files", "roboto-latin-wght-normal.woff2")
os.makedirs(OUT, exist_ok=True)

# Brand colours (match src/tokens.css)
INK, RED = "#0F0F0F", "#CC0000"            # on light
INK_D, RED_D = "#F1F1F1", "#FF4E45"        # on dark


def fmt(x):
    return f"{x:.2f}".rstrip("0").rstrip(".")


# ------------------------------------------------------------------ geometry → path
def ring_path(coords, r_convex):
    pts = list(coords)[:-1]
    n = len(pts)
    out = []
    for i in range(n):
        p, v, q = pts[i - 1], pts[i], pts[(i + 1) % n]
        a = (p[0] - v[0], p[1] - v[1]); b = (q[0] - v[0], q[1] - v[1])
        la, lb = math.hypot(*a), math.hypot(*b)
        ua, ub = (a[0] / la, a[1] / la), (b[0] / lb, b[1] / lb)
        theta = math.acos(max(-1, min(1, ua[0] * ub[0] + ua[1] * ub[1])))
        cross = (v[0] - p[0]) * (q[1] - v[1]) - (v[1] - p[1]) * (q[0] - v[0])
        r = r_convex if cross > 0 else 0
        cmd = "M" if i == 0 else "L"
        if r <= 0 or theta > math.pi - 1e-3:
            out.append(f"{cmd}{fmt(v[0])} {fmt(v[1])}")
            continue
        t = min(r / math.tan(theta / 2), min(la, lb) * 0.5)
        r = t * math.tan(theta / 2)
        s = (v[0] + ua[0] * t, v[1] + ua[1] * t); e = (v[0] + ub[0] * t, v[1] + ub[1] * t)
        out.append(f"{cmd}{fmt(s[0])} {fmt(s[1])}A{fmt(r)} {fmt(r)} 0 0 1 {fmt(e[0])} {fmt(e[1])}")
    return "".join(out) + "Z"


def capsule_path(g):
    g = orient(g.simplify(0.01), 1.0)
    r = min(g.bounds[3] - g.bounds[1], g.bounds[2] - g.bounds[0]) / 2
    return ring_path(g.exterior.coords, r)


def circle(cx, cy, r):
    return f"M{fmt(cx - r)} {fmt(cy)}A{fmt(r)} {fmt(r)} 0 1 0 {fmt(cx + r)} {fmt(cy)}A{fmt(r)} {fmt(r)} 0 1 0 {fmt(cx - r)} {fmt(cy)}Z"


# ------------------------------------------------------------------ the mark
def mark(t=34, g=22, growth=2.2, knob_r=31, ring=11, target=196, lift=3):
    """Returns dict of path strings: 'lines' (first two rows), 'bar' (third row), 'knob'."""
    lens = [t, t * growth, t * growth * growth]
    rows = [box(0, i * (t + g), L, i * (t + g) + t) for i, L in enumerate(lens)]
    kx, ky = lens[2], 2 * (t + g) + t / 2
    minx, miny = 0, 0
    maxx, maxy = kx + knob_r, max(ky + knob_r, 2 * (t + g) + t)
    k = target / max(maxx - minx, maxy - miny)
    dx = 128 - (minx + maxx) / 2 * k
    dy = 128 - (miny + maxy) / 2 * k - lift
    T = lambda geom: affinity.affine_transform(geom, [k, 0, 0, k, dx, dy])
    rows = [T(r) for r in rows]
    kx, ky, kr = kx * k + dx, ky * k + dy, knob_r * k
    hole = Point(kx, ky).buffer(kr + ring * k, 96)
    bar = rows[2].difference(hole)
    bar = max(bar.geoms, key=lambda p: p.area) if bar.geom_type != "Polygon" else bar
    return {
        "lines": capsule_path(rows[0]) + capsule_path(rows[1]),
        "bar": capsule_path(bar),
        "knob": circle(kx, ky, kr),
        "bounds": (min(r.bounds[0] for r in rows), min(r.bounds[1] for r in rows), kx + kr, max(ky + kr, rows[2].bounds[3])),
    }


# ------------------------------------------------------------------ wordmark
def wordmark(cap_px, weight=700, tracking=-10):
    """Outlined 'VidNotes'. Returns (body_path, dot_circle(cx, cy, r), width), cap height = cap_px."""
    from fontTools.pens.boundsPen import BoundsPen
    from fontTools.pens.recordingPen import RecordingPen
    from fontTools.pens.svgPathPen import SVGPathPen
    from fontTools.pens.transformPen import TransformPen
    from fontTools.ttLib import TTFont
    from fontTools.varLib.instancer import instantiateVariableFont

    font = instantiateVariableFont(TTFont(FONT), {"wght": weight})
    gs, cmap = font.getGlyphSet(), font.getBestCmap()
    s = cap_px / font["OS/2"].sCapHeight
    pen = SVGPathPen(gs)
    dot = None
    x = 0
    for ch in "VidNotes":
        name = cmap[ord(ch)]
        tf = (s, 0, 0, -s, x * s, cap_px)
        if ch == "i":
            # Split the i into contours; draw the stem, replace the dot with a true circle.
            rec = RecordingPen(); gs[name].draw(rec)
            contours, cur = [], []
            for op, args in rec.value:
                cur.append((op, args))
                if op in ("closePath", "endPath"):
                    contours.append(cur); cur = []
            def bounds(c):
                bp = BoundsPen(gs)
                for op, args in c:
                    getattr(bp, op)(*args)
                return bp.bounds
            contours.sort(key=lambda c: bounds(c)[3])
            stem, dotc = contours[0], contours[-1]
            tp = TransformPen(pen, tf)
            for op, args in stem:
                getattr(tp, op)(*args)
            b = bounds(dotc)
            cx, cy = (b[0] + b[2]) / 2, (b[1] + b[3]) / 2
            r = max(b[2] - b[0], b[3] - b[1]) / 2 * 1.04  # a circle reads smaller than a squarish dot
            dot = (cx * s + x * s, cap_px - cy * s, r * s)
        else:
            gs[name].draw(TransformPen(pen, tf))
        x += gs[name].width + tracking
    return pen.getCommands(), dot, (x - tracking) * s


# ------------------------------------------------------------------ files
def svg_doc(w, h, parts, title="VidNotes"):
    body = "\n".join(
        f'  <path fill="{c}"{(" transform=" + chr(34) + tr + chr(34)) if tr else ""} d="{d}"/>' for d, c, tr in parts
    )
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {fmt(w)} {fmt(h)}" role="img" aria-label="{title}">\n'
            f"  <title>{title}</title>\n{body}\n</svg>\n")


def write(name, text):
    with open(os.path.join(OUT, name), "w", encoding="utf-8") as fh:
        fh.write(text)


def symbol_parts(m, ink, red, dx=0, dy=0, sc=1):
    tr = f"translate({fmt(dx)} {fmt(dy)}) scale({fmt(sc)})" if (dx or dy or sc != 1) else ""
    return [(m["lines"], ink, tr), (m["bar"], red, tr), (m["knob"], red, tr)]


def main():
    m = mark()
    small = mark(t=40, g=24, growth=2.0, knob_r=34, ring=14, target=214, lift=0)  # ≤32 px cut

    for suffix, (ink, red) in {"": (INK, RED), "-dark": (INK_D, RED_D)}.items():
        write(f"vidnotes-symbol{suffix}.svg", svg_doc(256, 256, symbol_parts(m, ink, red)))
        write(f"vidnotes-symbol-small{suffix}.svg", svg_doc(256, 256, symbol_parts(small, ink, red)))

        # Horizontal lockup: symbol cropped to its bounds, wordmark cap height = 0.5 × symbol height.
        bx0, by0, bx1, by1 = m["bounds"]
        sh = by1 - by0
        cap = sh * 0.50
        wd, dot, ww = wordmark(cap)
        pad = sh * 0.06
        gap = sh * 0.36
        H = sh + 2 * pad
        sym = symbol_parts(m, ink, red, dx=pad - bx0, dy=pad - by0)
        wx, wy = pad + (bx1 - bx0) + gap, pad + (sh - cap) / 2
        parts = sym + [(wd, ink, f"translate({fmt(wx)} {fmt(wy)})"),
                       (circle(dot[0], dot[1], dot[2]), red, f"translate({fmt(wx)} {fmt(wy)})")]
        write(f"vidnotes-horizontal{suffix}.svg", svg_doc(wx + ww + pad, H, parts))

        # Stacked lockup: symbol above, wordmark centred below.
        cap2 = sh * 0.36
        wd2, dot2, ww2 = wordmark(cap2)
        W = max(bx1 - bx0, ww2) + 2 * pad
        sym2 = symbol_parts(m, ink, red, dx=(W - (bx1 - bx0)) / 2 - bx0, dy=pad - by0)
        wy2 = pad + sh + sh * 0.28
        wx2 = (W - ww2) / 2
        parts2 = sym2 + [(wd2, ink, f"translate({fmt(wx2)} {fmt(wy2)})"),
                         (circle(dot2[0], dot2[1], dot2[2]), red, f"translate({fmt(wx2)} {fmt(wy2)})")]
        write(f"vidnotes-stacked{suffix}.svg", svg_doc(W, wy2 + cap2 + pad, parts2))
    print("wrote", sorted(os.listdir(OUT)))


if __name__ == "__main__":
    main()
