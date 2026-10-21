// Figurerna är byggda av enkla former. Alla har samma delar så att
// animationerna i game.js fungerar för dem alla.
import * as THREE from '../vendor/three.module.min.js';

const TAU = Math.PI * 2;

/** Figurerna man kan välja. `stars` är hur många stjärnor som krävs för att låsa upp. */
export const CHARACTERS = [
  { id: 'kille', name: 'Kille', emoji: '👦', stars: 0 },
  { id: 'tjej', name: 'Tjej', emoji: '👧', stars: 0 },
  { id: 'katt', name: 'Katt', emoji: '🐱', stars: 6 },
  { id: 'hund', name: 'Hund', emoji: '🐶', stars: 15 },
  { id: 'haest', name: 'Häst', emoji: '🐴', stars: 30 },
];

const mat = (color) => new THREE.MeshLambertMaterial({ color });
const sph = (r, m, sx = 1, sy = 1, sz = 1) => {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 14), m);
  mesh.scale.set(sx, sy, sz);
  return mesh;
};
const at = (obj, x, y, z) => { obj.position.set(x, y, z); return obj; };

/** Ögon som blinkar, kinder och en liten mun. */
function addFace(head, { eyeX = 0.09, eyeY = -0.01, eyeZ = 0.2, mouthY = -0.11, mouthZ = 0.21, cheeks = true } = {}) {
  const white = mat(0xffffff);
  const dark = mat(0x2d3a4a);
  const eyes = new THREE.Group();
  eyes.position.y = eyeY;
  for (const s of [-1, 1]) {
    eyes.add(at(sph(0.056, white), eyeX * s, 0, eyeZ));
    eyes.add(at(sph(0.03, dark), eyeX * s, 0, eyeZ + 0.04));
    eyes.add(at(sph(0.011, white), eyeX * s + 0.01, 0.012, eyeZ + 0.066));
  }
  head.add(eyes);

  const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.011, 6, 14, Math.PI), mat(0x7a3b3b));
  mouth.position.set(0, mouthY, mouthZ);
  mouth.rotation.z = Math.PI; // bågen vänd uppåt blir ett leende
  head.add(mouth);

  if (cheeks) {
    const pink = new THREE.MeshLambertMaterial({ color: 0xff8fa3, transparent: true, opacity: 0.55 });
    for (const s of [-1, 1]) head.add(at(sph(0.04, pink, 1, 0.65, 0.3), 0.15 * s, -0.06, mouthZ - 0.04));
  }
  return { eyes, mouth, params: { eyeX, eyeY, eyeZ } };
}

/** Kropp, armar och ben som är gemensamma. */
function addBody(g, { torso, leg, hand }) {
  const body = sph(0.19, mat(torso), 1, 1.08, 0.95);
  body.position.y = 0.3;
  g.add(body);

  const arms = [];
  for (const s of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(0.19 * s, 0.4, 0);
    pivot.add(at(sph(0.06, mat(torso), 1, 1.7, 1), 0, -0.07, 0));
    pivot.add(at(sph(0.05, mat(hand)), 0, -0.16, 0));
    g.add(pivot);
    arms.push(pivot);
  }
  const legs = [];
  for (const s of [-1, 1]) {
    const l = sph(0.08, mat(leg), 1, 0.9, 1.25);
    l.position.set(0.09 * s, 0.07, 0);
    g.add(l);
    legs.push(l);
  }
  return { body, arms, legs };
}

function makeHead(g, skin, y = 0.66) {
  const head = new THREE.Group();
  head.position.y = y;
  head.add(sph(0.24, mat(skin)));
  g.add(head);
  return head;
}

const hairCap = (color) => {
  const cap = new THREE.Mesh(
    new THREE.SphereGeometry(0.248, 24, 14, 0, TAU, 0, Math.PI * 0.55), mat(color));
  cap.rotation.x = -0.3;
  return cap;
};

/** Något som hänger och dinglar, till exempel en tofs, en nyckelring eller en svans. */
function dangle(parent, x, y, z, build) {
  const pivot = new THREE.Group();
  pivot.position.set(x, y, z);
  build(pivot);
  parent.add(pivot);
  return pivot;
}

const builders = {
  kille(g) {
    const skin = 0xf2bf94;
    const { body, arms, legs } = addBody(g, { torso: 0x2f7be0, leg: 0x3b5b8a, hand: skin });
    g.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.28, 0.12), mat(0xe9a23b)), 0, 0.31, -0.2));
    const head = makeHead(g, skin);
    head.add(hairCap(0x5a3b24));
    const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.15, 10), mat(0x5a3b24));
    tuft.position.set(0.02, 0.27, 0.02);
    tuft.rotation.z = -0.4;
    head.add(tuft);
    const face = addFace(head);
    const key = dangle(g, 0.08, 0.2, -0.28, (p) => {
      p.add(at(sph(0.035, mat(0xff5d5d)), 0, -0.08, 0));
    });
    return { head, body, arms, legs, face, dangles: [key], tail: null, ears: [] };
  },

  tjej(g) {
    const skin = 0xf2bf94;
    const { body, arms, legs } = addBody(g, { torso: 0xff7fa8, leg: 0x6b4a9c, hand: skin });
    g.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.26, 0.11), mat(0xffd23f)), 0, 0.31, -0.2));
    const head = makeHead(g, skin);
    head.add(hairCap(0x7a4a2a));
    const bow = mat(0xe63946);
    head.add(at(sph(0.05, bow, 1.4, 1, 0.8), -0.06, 0.25, 0.06));
    head.add(at(sph(0.05, bow, 1.4, 1, 0.8), 0.06, 0.25, 0.06));
    head.add(at(sph(0.03, bow), 0, 0.25, 0.06));
    const tails = [-1, 1].map((s) => dangle(head, 0.2 * s, 0.1, -0.06, (p) => {
      p.add(at(sph(0.04, bow), 0, 0.0, 0));
      p.add(at(sph(0.075, mat(0x7a4a2a), 0.9, 1.5, 0.9), 0, -0.1, 0));
    }));
    const face = addFace(head);
    return { head, body, arms, legs, face, dangles: tails, tail: null, ears: [] };
  },

  katt(g) {
    const fur = 0xf29b4b;
    const { body, arms, legs } = addBody(g, { torso: fur, leg: fur, hand: fur });
    g.add(at(sph(0.13, mat(0xfff3e0), 0.7, 0.8, 0.35), 0, 0.28, 0.15));
    const head = makeHead(g, fur);
    const ears = [-1, 1].map((s) => dangle(head, 0.14 * s, 0.2, 0, (p) => {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.17, 12), mat(fur));
      ear.rotation.z = -0.25 * s;
      p.add(ear);
      const inner = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.11, 12), mat(0xffb3c0));
      inner.position.z = 0.025;
      inner.rotation.z = -0.25 * s;
      p.add(inner);
    }));
    for (const x of [-0.06, 0, 0.06]) {
      head.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.08, 0.02), mat(0xc4631c)), x, 0.2, 0.12));
    }
    head.add(at(sph(0.09, mat(0xfff3e0), 1.2, 0.8, 0.8), 0, -0.08, 0.17));
    head.add(at(sph(0.025, mat(0xff8fa3), 1.2, 0.8, 0.8), 0, -0.04, 0.25));
    for (const s of [-1, 1]) {
      for (const [dy, rz] of [[-0.03, 0.15], [-0.07, -0.1], [-0.11, -0.3]]) {
        const w = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.006, 0.006), mat(0x6b4a2a));
        w.position.set(0.16 * s, dy, 0.19);
        w.rotation.z = rz * s;
        head.add(w);
      }
    }
    const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.04, 8, 20), mat(0x3b82f6));
    scarf.position.y = 0.5;
    scarf.rotation.x = Math.PI / 2;
    g.add(scarf);
    const face = addFace(head, { mouthY: -0.13, mouthZ: 0.22 });
    const tail = dangle(g, 0, 0.22, -0.18, (p) => {
      [[0, 0, -0.04], [0, 0.07, -0.09], [0, 0.15, -0.1], [0, 0.23, -0.08]].forEach(([x, y, z], i) => {
        p.add(at(sph(0.05 - i * 0.004, mat(i === 3 ? 0xc4631c : fur)), x, y, z));
      });
    });
    return { head, body, arms, legs, face, dangles: [], tail, ears };
  },

  hund(g) {
    const fur = 0xe0b887;
    const { body, arms, legs } = addBody(g, { torso: fur, leg: fur, hand: fur });
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.03, 8, 20), mat(0xe63946));
    collar.position.y = 0.49;
    collar.rotation.x = Math.PI / 2;
    g.add(collar);
    const head = makeHead(g, fur);
    const ears = [-1, 1].map((s) => dangle(head, 0.21 * s, 0.12, 0, (p) => {
      p.add(at(sph(0.09, mat(0x8a5a2b), 0.6, 1.3, 0.8), 0.02 * s, -0.1, 0));
    }));
    head.add(at(sph(0.1, mat(0xf3dcb8), 1, 0.8, 1), 0, -0.07, 0.17));
    head.add(at(sph(0.04, mat(0x1c1c1c), 1.2, 0.8, 1), 0, -0.03, 0.27));
    head.add(at(sph(0.07, mat(0x8a5a2b), 1, 1, 0.5), -0.1, 0.05, 0.19));
    const face = addFace(head, { mouthY: -0.13, mouthZ: 0.255 });
    const tail = dangle(g, 0, 0.27, -0.18, (p) => {
      const t = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.2, 10), mat(0xc79a62));
      t.position.set(0, 0.07, -0.05);
      t.rotation.x = -0.6;
      p.add(t);
    });
    return { head, body, arms, legs, face, dangles: [], tail, ears };
  },

  haest(g) {
    const fur = 0xb06a3b;
    const mane = mat(0x3b2415);
    const { body, arms, legs } = addBody(g, { torso: fur, leg: fur, hand: 0x3b2415 });
    const head = makeHead(g, fur);
    head.add(at(sph(0.13, mat(0xc98a5a), 0.9, 0.85, 1.3), 0, -0.1, 0.19));
    for (const s of [-1, 1]) head.add(at(sph(0.014, mat(0x2b1a10)), 0.04 * s, -0.08, 0.33));
    head.add(at(sph(0.07, mat(0xffffff), 0.5, 1.5, 0.2), 0, 0.06, 0.225));
    const ears = [-1, 1].map((s) => dangle(head, 0.11 * s, 0.22, 0, (p) => {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.15, 10), mat(fur));
      ear.rotation.z = -0.15 * s;
      p.add(ear);
    }));
    head.add(at(sph(0.06, mane, 1.2, 1, 1), 0, 0.22, 0.1));
    [[0.22, -0.08], [0.14, -0.17], [0.04, -0.22], [-0.06, -0.23]].forEach(([y, z]) => {
      head.add(at(sph(0.07, mane), 0, y, z));
    });
    const face = addFace(head, { eyeX: 0.125, eyeY: 0.02, eyeZ: 0.17, mouthY: -0.17, mouthZ: 0.32, cheeks: false });
    const tail = dangle(g, 0, 0.26, -0.18, (p) => {
      [[0, -0.02, -0.05], [0, -0.1, -0.08], [0, -0.18, -0.08]].forEach(([x, y, z], i) => {
        p.add(at(sph(0.06 - i * 0.008, mane), x, y, z));
      });
    });
    return { head, body, arms, legs, face, dangles: [], tail, ears };
  },
};

export function makeHero(id) {
  const g = new THREE.Group();
  const parts = (builders[id] ?? builders.kille)(g);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  g.userData = parts;
  return g;
}

/**
 * Tillbehör efter väder. Alla syns bakifrån. Tidigare tillbehör tas bort först.
 * weather: 'none' | 'sun' | 'rain' | 'snow' | 'fog' | 'wind'
 */
export function setAccessory(hero, weather) {
  const ud = hero.userData;
  ud.undo?.forEach((f) => f());
  ud.undo = [];
  ud.flutter = [];
  ud.hold = null;
  if (!weather || weather === 'none') return;
  const { head, body, arms, legs, face } = ud;
  const add = (parent, obj) => {
    parent.add(obj);
    obj.traverse((m) => { if (m.isMesh) m.castShadow = true; });
    ud.undo.push(() => parent.remove(obj));
    return obj;
  };
  const recolor = (mesh, color) => {
    const old = mesh.material.color.getHex();
    mesh.material.color.setHex(color);
    ud.undo.push(() => mesh.material.color.setHex(old));
  };
  const lam = (c, e = 0x000000) => new THREE.MeshLambertMaterial({ color: c, emissive: e });
  const dome = (r, theta, color) => new THREE.Mesh(new THREE.SphereGeometry(r, 22, 14, 0, TAU, 0, theta), lam(color));

  if (weather === 'sun') {
    const { eyeX, eyeY, eyeZ } = face.params;
    const glass = new THREE.Group();
    const black = lam(0x15151a);
    for (const side of [-1, 1]) {
      glass.add(at(sph(0.07, black, 1, 0.85, 0.45), eyeX * side, eyeY, eyeZ + 0.05));
      glass.add(at(sph(0.012, lam(0xffffff), 1, 1, 1), eyeX * side + 0.02, eyeY + 0.025, eyeZ + 0.092));
    }
    glass.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.012, 0.012), black), 0, eyeY + 0.01, eyeZ + 0.085));
    add(head, glass);
    // Solhatt av halm
    const hat = new THREE.Group();
    hat.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.02, 24), lam(0xe8c96a)), 0, 0.2, 0));
    hat.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.19, 0.13, 20), lam(0xe8c96a)), 0, 0.26, 0));
    hat.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.195, 0.195, 0.035, 20), lam(0xe63946)), 0, 0.22, 0));
    hat.rotation.x = -0.12;
    add(head, hat);
  } else if (weather === 'rain') {
    // Gul regnrock med huva, röda stövlar och ett paraply vid sidan.
    const yellow = 0xffc92e;
    recolor(body, yellow);
    for (const arm of arms) recolor(arm.children[0], yellow);
    for (const leg of legs) recolor(leg, 0xd9363e);
    const hood = dome(0.268, Math.PI * 0.62, yellow);
    hood.rotation.x = -0.28;
    add(head, hood);
    // Paraply över huvudet: skaftet i handen, kupolen ovanför huvudet.
    const um = new THREE.Group();
    um.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.8, 8), lam(0x444444)), 0, 0.98, 0));
    const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.46, 24, 12, 0, TAU, 0, Math.PI * 0.5), lam(0xe63946));
    canopy.scale.y = 0.5;
    canopy.position.y = 1.34;
    um.add(canopy);
    for (let k = 0; k < 4; k++) {
      const stripe = new THREE.Mesh(new THREE.SphereGeometry(0.463, 24, 12, k * (TAU / 4), TAU / 8, 0, Math.PI * 0.5), lam(0xffffff));
      stripe.scale.y = 0.5;
      stripe.position.y = 1.34;
      um.add(stripe);
    }
    um.add(at(sph(0.025, lam(0x444444)), 0, 1.58, 0));
    um.position.set(0.24, 0, 0);
    add(hero, um);
    ud.hold = 'umbrella';
  } else if (weather === 'snow') {
    const beanie = new THREE.Group();
    const wool = dome(0.262, Math.PI * 0.42, 0x2f6fe0);
    beanie.add(wool);
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.254, 0.03, 8, 24), lam(0xffffff));
    band.rotation.x = Math.PI / 2;
    band.position.y = 0.065;
    beanie.add(band);
    beanie.add(at(sph(0.058, lam(0xffffff)), 0, 0.27, 0));
    beanie.rotation.x = -0.1;
    add(head, beanie);
    const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.05, 10, 24), lam(0xe63946));
    scarf.position.y = 0.5;
    scarf.rotation.x = Math.PI / 2;
    add(hero, scarf);
    add(hero, at(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.22, 0.035), lam(0xe63946)), 0.07, 0.38, -0.15));
  } else if (weather === 'night') {
    // Ficklampa i handen. Strålen och ljuset sitter på figuren (se game.js).
    const torch = new THREE.Group();
    // Byggd längs armen (-y) så att den pekar framåt när armen sträcks ut.
    torch.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.03, 0.16, 12), lam(0x2b2f3a)), 0, -0.25, 0));
    torch.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.055, 0.06, 12), lam(0xffd23f)), 0, -0.36, 0));
    torch.add(at(sph(0.04, lam(0xfff6c8, 0xffe27a), 1, 0.4, 1), 0, -0.392, 0));
    add(arms[1], torch);
    ud.hold = 'torch';
  } else if (weather === 'fog') {
    // Lykta i handen
    const lantern = new THREE.Group();
    lantern.add(at(new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.008, 6, 12), lam(0x222222)), 0, -0.2, 0.02));
    lantern.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.11, 12), lam(0x222222)), 0, -0.29, 0.02));
    lantern.add(at(sph(0.062, lam(0xffe27a, 0xffc300)), 0, -0.29, 0.02));
    add(arms[0], lantern);
  } else if (weather === 'wind') {
    const cap = new THREE.Group();
    cap.add(dome(0.258, Math.PI * 0.45, 0x2fa84f));
    cap.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.02, 0.14), lam(0x2fa84f)), 0, 0.06, 0.26));
    cap.add(at(sph(0.025, lam(0xffffff)), 0, 0.26, 0));
    cap.rotation.x = -0.12;
    add(head, cap);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.045, 10, 24), lam(0xffd23f));
    ring.position.y = 0.5;
    ring.rotation.x = Math.PI / 2;
    add(hero, ring);
    // Halsduksflik som fladdrar bakom
    const tail = new THREE.Group();
    tail.position.set(0.05, 0.48, -0.14);
    for (let i = 0; i < 5; i++) {
      const seg = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.03, 0.1), lam(i % 2 ? 0xffd23f : 0xe63946));
      seg.position.set(0, 0, -0.09 * i - 0.05);
      tail.add(seg);
      ud.flutter.push({ mesh: seg, i });
    }
    add(hero, tail);
  }
}
