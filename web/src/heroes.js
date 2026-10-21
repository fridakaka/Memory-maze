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
  return { eyes, mouth };
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
