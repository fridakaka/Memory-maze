// Butikens varor: kläder och tillbehör till figuren. Priserna är i diamanter.
export const SLOTS = [
  { id: 'hat', name: 'Hattar', emoji: '🎩' },
  { id: 'glasses', name: 'Glasögon', emoji: '😎' },
  { id: 'neck', name: 'Halsduk', emoji: '🧣' },
  { id: 'back', name: 'Rygg', emoji: '🦸' },
  { id: 'outfit', name: 'Kläder', emoji: '👕' },
  { id: 'shoes', name: 'Skor', emoji: '👟' },
];

export const ITEMS = [
  { id: 'cap', slot: 'hat', name: 'Keps', emoji: '🧢', price: 30 },
  { id: 'flower', slot: 'hat', name: 'Blomma', emoji: '🌸', price: 25 },
  { id: 'bow', slot: 'hat', name: 'Rosett', emoji: '🎀', price: 25 },
  { id: 'headphones', slot: 'hat', name: 'Hörlurar', emoji: '🎧', price: 60 },
  { id: 'tophat', slot: 'hat', name: 'Hög hatt', emoji: '🎩', price: 50 },
  { id: 'cowboy', slot: 'hat', name: 'Cowboyhatt', emoji: '🤠', price: 70 },
  { id: 'wizard', slot: 'hat', name: 'Trollkarlshatt', emoji: '🧙', price: 90 },
  { id: 'crown', slot: 'hat', name: 'Krona', emoji: '👑', price: 120 },

  { id: 'sunglasses', slot: 'glasses', name: 'Solglasögon', emoji: '😎', price: 25 },
  { id: 'round', slot: 'glasses', name: 'Runda glasögon', emoji: '🤓', price: 30 },
  { id: 'hearts', slot: 'glasses', name: 'Hjärtglasögon', emoji: '😍', price: 45 },
  { id: 'stars', slot: 'glasses', name: 'Stjärnglasögon', emoji: '🤩', price: 45 },

  { id: 'scarf-red', slot: 'neck', name: 'Röd halsduk', emoji: '🧣', price: 30, color: 0xe63946 },
  { id: 'scarf-yellow', slot: 'neck', name: 'Gul halsduk', emoji: '🟡', price: 30, color: 0xffd23f },
  { id: 'scarf-pink', slot: 'neck', name: 'Rosa halsduk', emoji: '🩷', price: 30, color: 0xff7fa8 },
  { id: 'bowtie', slot: 'neck', name: 'Fluga', emoji: '🎀', price: 35 },

  { id: 'cape-red', slot: 'back', name: 'Röd mantel', emoji: '🦸', price: 60, color: 0xd9363e },
  { id: 'cape-blue', slot: 'back', name: 'Blå mantel', emoji: '🦹', price: 60, color: 0x2f6fe0 },
  { id: 'backpack', slot: 'back', name: 'Ryggsäck', emoji: '🎒', price: 40 },
  { id: 'wings', slot: 'back', name: 'Änglavingar', emoji: '🪽', price: 100 },

  { id: 'outfit-pink', slot: 'outfit', name: 'Rosa tröja', emoji: '🩷', price: 20, color: 0xff7fa8 },
  { id: 'outfit-purple', slot: 'outfit', name: 'Lila tröja', emoji: '💜', price: 20, color: 0x9a5bd6 },
  { id: 'outfit-green', slot: 'outfit', name: 'Grön tröja', emoji: '💚', price: 20, color: 0x3fae55 },
  { id: 'outfit-orange', slot: 'outfit', name: 'Orange tröja', emoji: '🧡', price: 20, color: 0xff8a2a },
  { id: 'outfit-red', slot: 'outfit', name: 'Röd tröja', emoji: '❤️', price: 20, color: 0xe63946 },
  { id: 'outfit-black', slot: 'outfit', name: 'Svart tröja', emoji: '🖤', price: 30, color: 0x2a2a33 },

  { id: 'shoes-red', slot: 'shoes', name: 'Röda skor', emoji: '👟', price: 15, color: 0xe63946 },
  { id: 'shoes-pink', slot: 'shoes', name: 'Rosa skor', emoji: '🩷', price: 15, color: 0xff7fa8 },
  { id: 'shoes-white', slot: 'shoes', name: 'Vita skor', emoji: '🤍', price: 15, color: 0xf4f4f4 },
  { id: 'shoes-gold', slot: 'shoes', name: 'Guldskor', emoji: '✨', price: 50, color: 0xffc83d },
];

export const itemById = (id) => ITEMS.find((i) => i.id === id) ?? null;

/** Diamantpaket (testversion: ingenting debiteras). */
export const GEM_PACKS = [
  { gems: 50, price: '9 kr' },
  { gems: 150, price: '25 kr' },
  { gems: 400, price: '59 kr' },
];
