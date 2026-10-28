// Monster: ett per tema. Alla är byggda av enkla former, står på y = 0 och tittar mot +z.
import * as THREE from '../vendor/three.module.min.js';

const TAU = Math.PI * 2;

/** Vilket monster som hör till vilket tema. */
export const MONSTER_BY_THEME = {
  hedge: 'classic',
  flowers: 'classic',
  brick: 'golem',
  indoor: 'ghost',
  autumn: 'pumpkin',
  snow: 'yeti',
  library: 'ghost',
  candy: 'jelly',
  reef: 'crab',
  space: 'robot',
  stone: 'golem',
  aquarium: 'jelly',
};

const lam = (color, emissive = 0x000000, extra = {}) =>
  new THREE.MeshLambertMaterial({ color, emissive, ...extra });

function helpers(g) {
  const ball = (r, m, x, y, z, sx = 1, sy = 1, sz = 1) => {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 14), m);
    mesh.position.set(x, y, z);
    mesh.scale.set(sx, sy, sz);
    g.add(mesh);
    return mesh;
  };
  const box = (w, h, d, m, x, y, z) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    mesh.position.set(x, y, z);
    g.add(mesh);
    return mesh;
  };
  const cyl = (r1, r2, h, m, x, y, z) => {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, 16), m);
    mesh.position.set(x, y, z);
    g.add(mesh);
    return mesh;
  };
  const cone = (r, h, m, x, y, z) => {
    const mesh = new THREE.Mesh(new THREE.ConeGeometry(r, h, 12), m);
    mesh.position.set(x, y, z);
    g.add(mesh);
    return mesh;
  };
  return { ball, box, cyl, cone };
}

const eyePair = (h, x, y, z, r = 0.09, pupil = 0.045, eyeColor = 0xffffff, pupilColor = 0xd9304a) => {
  for (const s of [-1, 1]) {
    h.ball(r, lam(eyeColor), x * s, y, z);
    h.ball(pupil, lam(pupilColor, 0x330005), x * s, y, z + r * 0.85);
  }
};

const builders = {
  classic(g, h) {
    const purple = lam(0x5b3a8c);
    const horn = lam(0xf0e2c0);
    h.ball(0.34, purple, 0, 0.36, 0, 1, 0.95, 1);
    for (const s of [-1, 1]) {
      const hn = h.cone(0.07, 0.24, horn, 0.17 * s, 0.7, 0.02);
      hn.rotation.z = -0.35 * s;
      h.ball(0.1, purple, 0.17 * s, 0.07, 0.05);
    }
    eyePair(h, 0.13, 0.46, 0.27);
    h.box(0.22, 0.06, 0.05, lam(0x1b0f2b), 0, 0.27, 0.33);
  },

  ghost(g, h) {
    // Spöke: halvgenomskinligt med vågig nederkant som svävar.
    const white = lam(0xf4f8ff, 0x2a3a5a, { transparent: true, opacity: 0.88 });
    h.ball(0.33, white, 0, 0.62, 0);
    h.cyl(0.33, 0.36, 0.5, white, 0, 0.36, 0);
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * TAU;
      h.ball(0.11, white, Math.cos(a) * 0.27, 0.1, Math.sin(a) * 0.27);
    }
    for (const s of [-1, 1]) {
      h.ball(0.07, lam(0x101018), 0.13 * s, 0.68, 0.29, 0.8, 1.3, 0.5);
    }
    h.ball(0.06, lam(0x101018), 0, 0.5, 0.31, 1, 1.4, 0.5);
    for (const s of [-1, 1]) h.ball(0.09, white, 0.36 * s, 0.4, 0.05, 0.8, 1.2, 0.8);
    g.userData.float = 0.16;
  },

  crab(g, h) {
    const red = lam(0xe0523a);
    const dark = lam(0xa63a28);
    h.ball(0.36, red, 0, 0.3, 0, 1.25, 0.6, 1);
    // Stora klor
    for (const s of [-1, 1]) {
      h.cyl(0.04, 0.04, 0.3, dark, 0.38 * s, 0.34, 0.2).rotation.z = 0.7 * s;
      const claw = h.ball(0.14, red, 0.5 * s, 0.5, 0.34, 1, 0.8, 1.2);
      h.ball(0.06, dark, 0.52 * s, 0.5, 0.48, 0.7, 0.5, 1);
      claw.rotation.y = 0.2 * s;
      // Ögon på skaft
      h.cyl(0.02, 0.02, 0.18, dark, 0.12 * s, 0.6, 0.22);
      h.ball(0.07, lam(0xffffff), 0.12 * s, 0.7, 0.24);
      h.ball(0.035, lam(0x101018), 0.12 * s, 0.7, 0.3);
    }
    // Ben
    for (const s of [-1, 1]) {
      for (const z of [-0.12, 0.05, 0.2]) {
        const leg = h.cyl(0.025, 0.02, 0.28, dark, 0.45 * s, 0.14, z);
        leg.rotation.z = 1.0 * s;
      }
    }
    h.box(0.24, 0.05, 0.04, lam(0x4a1a12), 0, 0.28, 0.38);
  },

  yeti(g, h) {
    const fur = lam(0xe8f2fb);
    const shade = lam(0xc4d8ea);
    h.ball(0.38, fur, 0, 0.4, 0, 1, 1.05, 1);
    h.ball(0.28, fur, 0, 0.66, 0.02);
    h.ball(0.2, lam(0x7ea6c8), 0, 0.62, 0.2, 1.1, 0.9, 0.5);
    for (const s of [-1, 1]) {
      h.ball(0.1, shade, 0.34 * s, 0.4, 0.1, 0.9, 1.5, 0.9); // armar
      h.ball(0.12, shade, 0.18 * s, 0.07, 0.08, 1, 0.7, 1.4); // fötter
      h.ball(0.07, fur, 0.24 * s, 0.86, 0, 1, 1, 0.6); // öron
      h.ball(0.06, lam(0xffffff), 0.1 * s, 0.7, 0.3);
      h.ball(0.03, lam(0x101820), 0.1 * s, 0.7, 0.34);
      const brow = h.box(0.12, 0.025, 0.03, lam(0x203040), 0.1 * s, 0.77, 0.31);
      brow.rotation.z = 0.4 * s;
    }
    h.box(0.2, 0.05, 0.04, lam(0x203040), 0, 0.55, 0.33);
    for (const s of [-1, 1]) h.cone(0.025, 0.07, lam(0xffffff), 0.05 * s, 0.52, 0.34).rotation.x = Math.PI;
  },

  robot(g, h) {
    const metal = lam(0x8d98ac);
    const dark = lam(0x3b4455);
    h.box(0.5, 0.42, 0.4, metal, 0, 0.34, 0);
    h.box(0.4, 0.3, 0.34, metal, 0, 0.68, 0);
    h.box(0.32, 0.08, 0.04, lam(0xff3b3b, 0xff0000), 0, 0.7, 0.18);
    h.cyl(0.02, 0.02, 0.2, dark, 0, 0.95, 0);
    h.ball(0.05, lam(0xff3b3b, 0xff2020), 0, 1.07, 0);
    for (const s of [-1, 1]) {
      h.cyl(0.05, 0.05, 0.34, dark, 0.34 * s, 0.38, 0);
      h.box(0.1, 0.1, 0.1, dark, 0.34 * s, 0.18, 0.02);
      const wheel = h.cyl(0.11, 0.11, 0.08, dark, 0.2 * s, 0.1, 0);
      wheel.rotation.z = Math.PI / 2;
    }
    h.box(0.3, 0.05, 0.03, dark, 0, 0.5, 0.21);
  },

  jelly(g, h) {
    const pink = lam(0xff6fa8, 0x5a1030, { transparent: true, opacity: 0.82 });
    h.ball(0.34, pink, 0, 0.36, 0, 1.05, 1.1, 1);
    h.ball(0.2, pink, 0, 0.66, 0.02);
    for (const s of [-1, 1]) {
      h.ball(0.12, pink, 0.2 * s, 0.84, 0, 1, 1, 0.8); // öron
      h.ball(0.1, pink, 0.36 * s, 0.34, 0.05, 0.8, 1.2, 0.8);
      h.ball(0.06, lam(0xffffff), 0.09 * s, 0.68, 0.18);
      h.ball(0.03, lam(0x301020), 0.09 * s, 0.68, 0.22);
    }
    h.ball(0.06, lam(0xffffff, 0xffffff, { transparent: true, opacity: 0.6 }), -0.14, 0.52, 0.28, 0.6, 1.2, 0.4);
    h.box(0.14, 0.04, 0.04, lam(0x601030), 0, 0.58, 0.19);
  },

  golem(g, h) {
    const stone = lam(0x7d8185);
    const dark = lam(0x5f6366);
    const moss = lam(0x5d8f4d);
    h.box(0.54, 0.36, 0.4, stone, 0, 0.22, 0);
    h.box(0.4, 0.34, 0.36, dark, 0, 0.55, 0);
    h.box(0.42, 0.06, 0.38, moss, 0, 0.74, 0);
    for (const s of [-1, 1]) {
      h.box(0.14, 0.34, 0.16, stone, 0.38 * s, 0.34, 0);
      h.box(0.16, 0.12, 0.18, dark, 0.38 * s, 0.14, 0);
      h.box(0.1, 0.06, 0.03, lam(0xffa033, 0xff7a00), 0.1 * s, 0.6, 0.19);
    }
    h.box(0.16, 0.04, 0.03, lam(0x2b2f33), 0, 0.46, 0.19);
  },

  pumpkin(g, h) {
    const orange = lam(0xf08a1c);
    h.ball(0.38, orange, 0, 0.42, 0, 1.2, 0.95, 1.1);
    for (let k = 0; k < 4; k++) {
      const rib = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.018, 6, 24), lam(0xc4680f));
      rib.position.y = 0.42;
      rib.scale.set(1.2, 0.95, 1.1);
      rib.rotation.y = (k * Math.PI) / 4;
      g.add(rib);
    }
    h.cyl(0.05, 0.07, 0.16, lam(0x4a7a2a), 0.02, 0.84, 0).rotation.z = 0.25;
    const glow = lam(0xffe27a, 0xffc300);
    for (const s of [-1, 1]) {
      const eye = h.cone(0.07, 0.1, glow, 0.15 * s, 0.5, 0.4);
      eye.rotation.x = Math.PI / 2;
    }
    h.box(0.3, 0.07, 0.04, glow, 0, 0.3, 0.42);
    for (const s of [-1, 1]) h.cone(0.03, 0.06, lam(0x2b1a08), 0.08 * s, 0.34, 0.43).rotation.x = Math.PI;
    for (const s of [-1, 1]) h.ball(0.1, lam(0x4a7a2a), 0.2 * s, 0.07, 0.05, 1, 0.7, 1.3);
  },
};

export function makeMonster(kind = 'classic') {
  const g = new THREE.Group();
  const h = helpers(g);
  (builders[kind] ?? builders.classic)(g, h);
  g.userData.kind = kind;
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  g.visible = false;
  return g;
}
