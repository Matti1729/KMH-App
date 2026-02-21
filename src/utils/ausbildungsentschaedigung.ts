// Ausbildungsentschädigungsrechner
// Basierend auf der DFL/DFB-Vereinbarung 2024 (Anhang V zur LO)

export type Altersklasse = 'U13' | 'U14' | 'U15' | 'U16' | 'U17' | 'U18' | 'U19' | 'U20' | 'U21';
export type Liga = 'BL' | '2BL' | '3Liga' | 'RL';
export type LZKategorie = 'mindest' | 'erwartbar';

export const LIGA_LABELS: Record<Liga, string> = {
  BL: 'Bundesliga',
  '2BL': '2. Bundesliga',
  '3Liga': '3. Liga',
  RL: 'Regionalliga',
};

export interface AEInput {
  altersklasse: Altersklasse;
  verweildauerJahre: number;
  warInU11UndU12: boolean;
  entfernungAufnehmend: number;
  entfernungAbgebend: number;
  ligaAbgebend: Liga;
  lzKategorie: LZKategorie;
  vertragsangebotUnterbreitet: boolean;
  unterbringungJahre: number;
}

export interface AEFaktor {
  name: string;
  wert: number;
}

export interface AEResult {
  liga: Liga;
  ligaLabel: string;
  ausbildungsentschaedigung: number;
  unterbringungsentschaedigung: number;
  gesamt: number;
  faktoren: AEFaktor[];
}

const GRUNDBETRAG = 20_000;
const UNTERBRINGUNG_PRO_JAHR = 15_000;

// Ziffer 3.4: Altersklasse
function getAltersklasseFaktor(ak: Altersklasse): number {
  switch (ak) {
    case 'U13': return 1.75;
    case 'U14': return 1.5;
    case 'U15': return 1.25;
    default: return 1.0;
  }
}

// Ziffer 3.5: Verweildauer
const VERWEILDAUER_FAKTOREN: Record<number, number> = {
  1: 2.0,
  2: 1.5,
  3: 2.25,
  4: 3.0,
  5: 3.75,
  6: 4.5,
  7: 5.25,
};

function getVerweildauerFaktor(jahre: number, ak: Altersklasse, warInU11UndU12: boolean): number {
  if (ak === 'U13' && warInU11UndU12) return 1.0;
  const capped = Math.min(Math.max(jahre, 1), 7);
  return VERWEILDAUER_FAKTOREN[capped];
}

// Ziffer 3.6: Entfernung
function isU13bisU15(ak: Altersklasse): boolean {
  return ak === 'U13' || ak === 'U14' || ak === 'U15';
}

function getEntfernungFaktor(ak: Altersklasse, entfAufn: number, entfAbg: number): number {
  if (!isU13bisU15(ak)) return 1.0;
  if (entfAufn < entfAbg) return 1.0;
  if (entfAufn >= 150) return 2.5;
  if (entfAufn >= 100) return 1.5;
  return 1.0;
}

// Ziffer 3.7: Spielklassenzugehörigkeit
type SpielklassenMatrix = Record<Liga, Record<Liga, { bisU15: number; abU16: number }>>;

const SPIELKLASSEN_MATRIX: SpielklassenMatrix = {
  BL: {
    BL:     { bisU15: 1.25, abU16: 1.0 },
    '2BL':  { bisU15: 0.75, abU16: 0.75 },
    '3Liga':{ bisU15: 0.5,  abU16: 0.5 },
    RL:     { bisU15: 0.5,  abU16: 0.5 },
  },
  '2BL': {
    BL:     { bisU15: 1.0,  abU16: 1.0 },
    '2BL':  { bisU15: 0.94, abU16: 0.75 },
    '3Liga':{ bisU15: 0.5,  abU16: 0.5 },
    RL:     { bisU15: 0.5,  abU16: 0.5 },
  },
  '3Liga': {
    BL:     { bisU15: 1.0,  abU16: 1.0 },
    '2BL':  { bisU15: 0.75, abU16: 0.75 },
    '3Liga':{ bisU15: 0.63, abU16: 0.5 },
    RL:     { bisU15: 0.5,  abU16: 0.5 },
  },
  RL: {
    BL:     { bisU15: 1.0,  abU16: 1.0 },
    '2BL':  { bisU15: 0.75, abU16: 0.75 },
    '3Liga':{ bisU15: 0.5,  abU16: 0.5 },
    RL:     { bisU15: 0.63, abU16: 0.5 },
  },
};

function getSpielklasseFaktor(abg: Liga, aufn: Liga, ak: Altersklasse): number {
  const entry = SPIELKLASSEN_MATRIX[abg][aufn];
  return isU13bisU15(ak) ? entry.bisU15 : entry.abU16;
}

// Ziffer 3.8: Kategorie Leistungszentrum
function getLZKategorieFaktor(kat: LZKategorie): number {
  return kat === 'erwartbar' ? 1.0 : 0.5;
}

// Ziffer 3.9: Vertragsangebot
function getVertragsangebotFaktor(ak: Altersklasse, angebot: boolean): number {
  const akNum = parseInt(ak.replace('U', ''), 10);
  if (akNum < 16) return 1.0;
  return angebot ? 1.0 : 0.75;
}

// Ziffer 4.2: Unterbringungsentschädigung
function getUnterbringung(ak: Altersklasse, jahre: number): number {
  const akNum = parseInt(ak.replace('U', ''), 10);
  if (akNum < 16) return 0;
  return jahre * UNTERBRINGUNG_PRO_JAHR;
}

export function berechneAE(input: AEInput): AEResult[] {
  const ligen: Liga[] = ['BL', '2BL', '3Liga', 'RL'];

  return ligen.map((aufn) => {
    const fAlter = getAltersklasseFaktor(input.altersklasse);
    const fVerweildauer = getVerweildauerFaktor(input.verweildauerJahre, input.altersklasse, input.warInU11UndU12);
    const fEntfernung = getEntfernungFaktor(input.altersklasse, input.entfernungAufnehmend, input.entfernungAbgebend);
    const fSpielklasse = getSpielklasseFaktor(input.ligaAbgebend, aufn, input.altersklasse);
    const fKategorie = getLZKategorieFaktor(input.lzKategorie);
    const fAngebot = getVertragsangebotFaktor(input.altersklasse, input.vertragsangebotUnterbreitet);

    const ae = GRUNDBETRAG * fAlter * fVerweildauer * fEntfernung * fSpielklasse * fKategorie * fAngebot;
    const unterbringung = getUnterbringung(input.altersklasse, input.unterbringungJahre);

    return {
      liga: aufn,
      ligaLabel: LIGA_LABELS[aufn],
      ausbildungsentschaedigung: Math.round(ae * 100) / 100,
      unterbringungsentschaedigung: unterbringung,
      gesamt: Math.round((ae + unterbringung) * 100) / 100,
      faktoren: [
        { name: 'Grundbetrag', wert: GRUNDBETRAG },
        { name: 'Altersklasse', wert: fAlter },
        { name: 'Verweildauer', wert: fVerweildauer },
        { name: 'Entfernung', wert: fEntfernung },
        { name: 'Spielklasse', wert: fSpielklasse },
        { name: 'LZ-Kategorie', wert: fKategorie },
        { name: 'Vertragsangebot', wert: fAngebot },
      ],
    };
  });
}

export function formatEUR(betrag: number): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(betrag);
}
