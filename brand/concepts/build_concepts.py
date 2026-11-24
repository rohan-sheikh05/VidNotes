"""Build VidNotes logo concepts (black on white) as clean SVG paths.

Geometry is constructed with shapely booleans, then every corner is rounded with true arcs
(no buffered polylines), so files stay low-anchor and editable.
"""
import math, os, sys
from shapely.geometry import Polygon, Point, box
from shapely.ops import unary_union
from shapely import affinity
from shapely.geometry.polygon import orient

OUT = sys.argv[1]
os.makedirs(OUT, exist_ok=True)
FONT = sys.argv[2]


# ---------------------------------------------------------------- path writing
def _ring_path(coords, r_convex, r_concave, ccw):
    pts = list(coords)[:-1]
    n = len(pts)
    segs = []
    for i in range(n):
        p, v, q = pts[i - 1], pts[i], pts[(i + 1) % n]
        a = (p[0] - v[0], p[1] - v[1]); b = (q[0] - v[0], q[1] - v[1])
        la, lb = math.hypot(*a), math.hypot(*b)
        ua, ub = (a[0] / la, a[1] / la), (b[0] / lb, b[1] / lb)
        cos_t = max(-1, min(1, ua[0] * ub[0] + ua[1] * ub[1]))
        theta = math.acos(cos_t)
        cross = (v[0] - p[0]) * (q[1] - v[1]) - (v[1] - p[1]) * (q[0] - v[0])
        convex = (cross > 0) == ccw  # left turn on a ccw ring = convex corner
        r = r_convex if convex else r_concave
        if r <= 0 or theta > math.pi - 1e-3:
            segs.append(("pt", v)); continue
        t = r / math.tan(theta / 2)
        tmax = min(la, lb) * 0.5
        if t > tmax:
            t = tmax; r = t * math.tan(theta / 2)
        s = (v[0] + ua[0] * t, v[1] + ua[1] * t); e = (v[0] + ub[0] * t, v[1] + ub[1] * t)
        sweep = 1 if cross > 0 else 0
        segs.append(("arc", s, e, r, sweep))
    f = lambda x: f"{x:.2f}".rstrip("0").rstrip(".")
    out = []
    for k, sg in enumerate(segs):
        if sg[0] == "pt":
            out.append(("M" if k == 0 else "L") + f"{f(sg[1][0])} {f(sg[1][1])}")
        else:
            _, s, e, r, sw = sg
            out.append(("M" if k == 0 else "L") + f"{f(s[0])} {f(s[1])}")
            out.append(f"A{f(r)} {f(r)} 0 0 {sw} {f(e[0])} {f(e[1])}")
    return "".join(out) + "Z"


def geom_path(g, r_convex=0, r_concave=0):
    polys = [g] if g.geom_type == "Polygon" else list(g.geoms)
    polys = [p for p in polys if p.geom_type == "Polygon" and p.area > 1]
    d = []
    for p in polys:
        p = orient(p.simplify(0.01), 1.0)  # exterior ccw (maths), holes cw
        d.append(_ring_path(p.exterior.coords, r_convex, r_concave, True))
        for h in p.interiors:
            d.append(_ring_path(h.coords, r_convex, r_concave, False))
    return "".join(d)


def svg(paths, w=256, h=256, title="VidNotes"):
    body = "\n".join(f'  <path fill="{c}" fill-rule="evenodd" d="{d}"/>' for d, c in paths)
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" role="img" aria-label="{title}">\n'
            f"  <title>{title}</title>\n{body}\n</svg>\n")


def circle_path(cx, cy, r):
    return f"M{cx - r} {cy}A{r} {r} 0 1 0 {cx + r} {cy}A{r} {r} 0 1 0 {cx - r} {cy}Z"


# ---------------------------------------------------------------- wordmark
def wordmark(text, weight, height_px, tracking=0.0):
    """Outline `text` in Roboto at `weight`; returns (path_d, width) scaled so cap height = height_px."""
    from fontTools.ttLib import TTFont
    from fontTools.varLib.instancer import instantiateVariableFont
    from fontTools.pens.svgPathPen import SVGPathPen
    from fontTools.pens.transformPen import TransformPen
    font = instantiateVariableFont(TTFont(FONT), {"wght": weight})
    gs, cmap = font.getGlyphSet(), font.getBestCmap()
    cap = font["OS/2"].sCapHeight
    s = height_px / cap
    pen = SVGPathPen(gs)
    x = 0
    for ch in text:
        gn = cmap[ord(ch)]
        tp = TransformPen(pen, (s, 0, 0, -s, x * s, height_px))
        gs[gn].draw(tp)
        x += gs[gn].width + tracking * 1000
    return pen.getCommands(), (x - tracking * 1000) * s


def lockup(symbol_d_list, name, sym_scale=1.0):
    """Horizontal lockup: symbol (256 box) + wordmark, height 256."""
    cap = 92
    d, w = wordmark("VidNotes", 700, cap, tracking=-0.01)
    gap = 44
    x0 = 256 + gap
    y0 = (256 - cap) / 2
    W = math.ceil(x0 + w + 8)
    paths = [(dd, c) for dd, c in symbol_d_list]
    paths.append((d, "#000"))
    body = "\n".join(f'  <path fill="{c}" fill-rule="evenodd" d="{dd}"/>' for dd, c in paths[:-1])
    body += f'\n  <path fill="#000" transform="translate({x0} {y0:.1f})" d="{d}"/>'
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} 256" role="img" aria-label="VidNotes">\n'
            f"  <title>VidNotes</title>\n{body}\n</svg>\n")


def save(name, content):
    with open(os.path.join(OUT, name), "w", encoding="utf-8") as fh:
        fh.write(content)


# ---------------------------------------------------------------- A: Play of notes
def concept_a(n=5, g=12, H=196, r=6):
    """A play triangle sliced into note lines: the video, written down."""
    W = H * math.sqrt(3) / 2
    x0 = 128 - W / 2 + 9            # optical centring: a play shape's mass sits left
    y0 = 128 - H / 2
    tri = Polygon([(x0, y0), (x0, y0 + H), (x0 + W, 128)])
    t = (H - (n - 1) * g) / n
    bars = unary_union([box(x0 - 1, y0 + i * (t + g), x0 + W + 1, y0 + i * (t + g) + t) for i in range(n)])
    return [(geom_path(tri.intersection(bars), r, 0), "#000")]


# ---------------------------------------------------------------- B: Intervals
def concept_b():
    t = 34; g = 24; x0 = 34
    lens = [34, 34 * 3, 34 * 3 + 58]  # dot · short · long — lines that grow like review intervals
    top = 128 - (3 * t + 2 * g + 13) / 2 - 2  # +13: knob overhang below the last bar; -2: optical lift
    shapes = []
    for i, L in enumerate(lens):
        y = top + i * (t + g)
        shapes.append(box(x0, y, x0 + L, y + t))
    # Playhead knob at the end of the longest line.
    yb = top + 2 * (t + g) + t / 2
    knob_r = 30
    kx = x0 + lens[2]
    paths = [(geom_path(s, t / 2, 0), "#000") for s in shapes[:2]]
    bar = shapes[2].difference(Point(kx, yb).buffer(knob_r + 9, 64))
    paths.append((geom_path(bar, t / 2, 0), "#000"))
    paths.append((circle_path(kx, yb, knob_r), "#000"))
    return paths


# ---------------------------------------------------------------- C: Bookmark V
def concept_c():
    w, h = 144, 208
    x0, y0 = 128 - w / 2, 128 - h / 2 + 7  # notch removes bottom mass: sit lower
    notch = 60
    bm = Polygon([(x0, y0), (x0 + w, y0), (x0 + w, y0 + h), (128, y0 + h - notch), (x0, y0 + h)])
    # Play triangle cut out of the upper body, optically centred in the area above the notch.
    ph = 70; pw = ph * math.sqrt(3) / 2
    cx, cy = 128 + 5, y0 + 78
    play = Polygon([(cx - pw / 2, cy - ph / 2), (cx - pw / 2, cy + ph / 2), (cx + pw / 2, cy)])
    # Rounded play hole: build separately so its radius differs from the outer body.
    body_d = geom_path(bm, 18, 4)
    play_d = _ring_path(list(orient(play, 1.0).exterior.coords), 8, 0, True)
    return [(body_d + play_d, "#000")]


A, B, C = concept_a(), concept_b(), concept_c()
for key, paths in (("a", A), ("b", B), ("c", C)):
    save(f"concept-{key}-symbol.svg", svg(paths))
    save(f"concept-{key}-lockup.svg", lockup(paths, key))
print("written to", OUT)

# ---------------------------------------------------------------- B variants (round 2)
def _fit(shapes, knob, target=196, lift=3):
    """Scale + centre shapes and knob (cx, cy, r) into the 256 canvas; returns transformed copies."""
    minx = min([g.bounds[0] for g in shapes] + [knob[0] - knob[2]])
    miny = min([g.bounds[1] for g in shapes] + [knob[1] - knob[2]])
    maxx = max([g.bounds[2] for g in shapes] + [knob[0] + knob[2]])
    maxy = max([g.bounds[3] for g in shapes] + [knob[1] + knob[2]])
    k = target / max(maxx - minx, maxy - miny)
    dx = 128 - (minx + maxx) / 2 * k
    dy = 128 - (miny + maxy) / 2 * k - lift
    T = lambda g: affinity.affine_transform(g, [k, 0, 0, k, dx, dy])
    return [T(g) for g in shapes], (knob[0] * k + dx, knob[1] * k + dy, knob[2] * k), k


def _b_paths(shapes, knob, ring, radius_of):
    shapes, (kx, ky, kr), k = _fit(shapes, knob)
    hole = Point(kx, ky).buffer(kr + ring * k, 64)
    out = []
    for g in shapes:
        g2 = g.difference(hole)
        r = min(g.bounds[3] - g.bounds[1], g.bounds[2] - g.bounds[0]) / 2  # capsule ends
        out.append((geom_path(g2, r, 0), "#000"))
    f = lambda x: round(x, 2)
    out.append((circle_path(f(kx), f(ky), f(kr)), "#000"))
    return out


def concept_b1():
    """Refined: steady ×2.2 growth, wider ring."""
    t, g = 34, 22
    lens = [t, t * 2.2, t * 2.2 * 2.2]
    rows = [box(0, i * (t + g), L, i * (t + g) + t) for i, L in enumerate(lens)]
    knob = (lens[2], 2 * (t + g) + t / 2, 31)
    return _b_paths(rows, knob, 11, lambda g_: t / 2)


def concept_b2():
    """Scrubber: the last line is a video progress bar (watched · playhead · unwatched track)."""
    t, g, track = 34, 22, 13
    lens = [t, t * 2.3]
    rows = [box(0, i * (t + g), L, i * (t + g) + t) for i, L in enumerate(lens)]
    yb = 2 * (t + g) + t / 2
    kx = t * 2.3 * 1.75
    W = kx + 92  # unwatched track: long enough to read as the rest of the timeline
    played = box(0, yb - t / 2, kx, yb + t / 2)
    rest = box(kx, yb - track / 2, W, yb + track / 2)
    knob = (kx, yb, 31)
    return _b_paths(rows + [played, rest], knob, 10,
                    lambda g_: track / 2 if (g_.bounds[3] - g_.bounds[1]) < t - 1 else t / 2)


def concept_b3():
    """Timeline stairs: each interval starts where the last ended, rising to the playhead."""
    t, g = 30, 20
    lens = [t, t * 2.2, t * 2.2 * 2.0]
    rows, x = [], 0
    for i, L in enumerate(lens):
        y = (2 - i) * (t + g)  # bottom row first: rising
        rows.append(box(x, y, x + L, y + t))
        x += L + 6
    knob = (x - 6, t / 2, 28)
    return _b_paths(rows, knob, 10, lambda g_: t / 2)


for key, fn in (("b1", concept_b1), ("b2", concept_b2), ("b3", concept_b3)):
    paths = fn()
    save(f"concept-{key}-symbol.svg", svg(paths))
    save(f"concept-{key}-lockup.svg", lockup(paths, key))
print("round 2 written")
