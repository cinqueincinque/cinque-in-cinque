// ==========================================================================
// 5 IN 5 - MOTORE SELEZIONE DETERMINISTICA DELLE PAROLE (words.js)
// ==========================================================================

// Filtro rigoroso per garantire la correttezza delle lunghezze
const POOL_4 = (typeof RAW_WORDS_4 !== "undefined" ? RAW_WORDS_4 : []).filter(w => w.length === 4);
const POOL_5 = (typeof RAW_WORDS_5 !== "undefined" ? RAW_WORDS_5 : []).filter(w => w.length === 5);
const POOL_6 = (typeof RAW_WORDS_6 !== "undefined" ? RAW_WORDS_6 : []).filter(w => w.length === 6);
const POOL_7 = (typeof RAW_WORDS_7 !== "undefined" ? RAW_WORDS_7 : []).filter(w => w.length === 7);
const POOL_8 = (typeof RAW_WORDS_8 !== "undefined" ? RAW_WORDS_8 : []).filter(w => w.length === 8);

// Fallback di sicurezza se il dizionario non dovesse caricarsi
const FALLBACK_WORDS = ["CASA", "MONTE", "STRADA", "MERCATO", "GIORNATA"];

// Generatore Pseudo-Casuale Deterministico (Mulberry32)
function mulberry32(a) {
  return function() {
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// Mescolamento deterministico Fisher-Yates per la griglia
function shuffleArrayWithSeed(array, seedNumber) {
  const rng = mulberry32(seedNumber);
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// Estrazione deterministica della sfida del giorno
function getDailyPuzzle() {
  const urlParams = new URLSearchParams(window.location.search);
  const dayParam = urlParams.get("day");

  let dayIndex = 0;

  if (dayParam !== null && !isNaN(parseInt(dayParam, 10))) {
    dayIndex = Math.max(0, parseInt(dayParam, 10) - 1);
  } else {
    const epoch = new Date(2026, 0, 1).getTime();
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    dayIndex = Math.max(0, Math.floor((today - epoch) / (1000 * 60 * 60 * 24)));
  }

  // Creazione di seed unici e indipendenti per ogni lunghezza di parola
  const seed4 = (dayIndex + 1) * 1103515245 + 12345;
  const seed5 = (dayIndex + 1) * 214013 + 2531011;
  const seed6 = (dayIndex + 1) * 1664525 + 1013904223;
  const seed7 = (dayIndex + 1) * 22695477 + 1;
  const seed8 = (dayIndex + 1) * 69069 + 1;

  const w4 = POOL_4.length > 0 ? POOL_4[Math.floor(mulberry32(seed4)() * POOL_4.length)] : FALLBACK_WORDS[0];
  const w5 = POOL_5.length > 0 ? POOL_5[Math.floor(mulberry32(seed5)() * POOL_5.length)] : FALLBACK_WORDS[1];
  const w6 = POOL_6.length > 0 ? POOL_6[Math.floor(mulberry32(seed6)() * POOL_6.length)] : FALLBACK_WORDS[2];
  const w7 = POOL_7.length > 0 ? POOL_7[Math.floor(mulberry32(seed7)() * POOL_7.length)] : FALLBACK_WORDS[3];
  const w8 = POOL_8.length > 0 ? POOL_8[Math.floor(mulberry32(seed8)() * POOL_8.length)] : FALLBACK_WORDS[4];

  return {
    dayNumber: dayIndex + 1,
    dateString: `Giorno #${dayIndex + 1}`,
    words: [w4, w5, w6, w7, w8]
  };
}

function normalizeItalianText(str) {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();
}