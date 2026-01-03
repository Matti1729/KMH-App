// DFB Nationalmannschaft Termine Service
// Diese Daten werden von dfb.de geparst und können manuell aktualisiert werden

export interface DFBTermin {
  datumStart: string;
  datumEnde?: string;
  zeit?: string; // Nur wenn bekannt!
  art: 'DFB-Maßnahme';
  eventTyp: 'Spiel' | 'Lehrgang' | 'Turnier' | 'Camp' | 'Sichtung';
  titel: string;
  jahrgang: string;
  ort?: string;
  gegner?: string;
  wettbewerb?: string;
}

export const DFB_LAST_UPDATE = '2026-01-03T18:00:00';

export const DFB_TERMINE: DFBTermin[] = [
  // U21
  { datumStart: '2026-03-22', datumEnde: '2026-04-01', art: 'DFB-Maßnahme', eventTyp: 'Lehrgang', titel: 'Lehrgang', jahrgang: 'U21' },
  { datumStart: '2026-03-27', zeit: '18:00', art: 'DFB-Maßnahme', eventTyp: 'Spiel', titel: 'Deutschland - Nordirland (EMQ)', jahrgang: 'U21', ort: 'Braunschweig', gegner: 'Nordirland', wettbewerb: 'EMQ' },
  { datumStart: '2026-03-31', art: 'DFB-Maßnahme', eventTyp: 'Spiel', titel: 'Griechenland - Deutschland (EMQ)', jahrgang: 'U21', ort: 'Athen', gegner: 'Griechenland', wettbewerb: 'EMQ' },
  { datumStart: '2026-09-26', art: 'DFB-Maßnahme', eventTyp: 'Spiel', titel: 'Lettland - Deutschland (EMQ)', jahrgang: 'U21', gegner: 'Lettland', wettbewerb: 'EMQ' },
  { datumStart: '2026-09-30', art: 'DFB-Maßnahme', eventTyp: 'Spiel', titel: 'Malta - Deutschland (EMQ)', jahrgang: 'U21', gegner: 'Malta', wettbewerb: 'EMQ' },
  { datumStart: '2026-10-06', art: 'DFB-Maßnahme', eventTyp: 'Spiel', titel: 'Deutschland - Georgien (EMQ)', jahrgang: 'U21', gegner: 'Georgien', wettbewerb: 'EMQ' },
  
  // U20
  { datumStart: '2026-03-23', datumEnde: '2026-03-31', art: 'DFB-Maßnahme', eventTyp: 'Lehrgang', titel: 'Lehrgang mit Länderspielen', jahrgang: 'U20' },
  { datumStart: '2026-03-26', art: 'DFB-Maßnahme', eventTyp: 'Spiel', titel: 'Deutschland - Tschechien (LSP)', jahrgang: 'U20', gegner: 'Tschechien', wettbewerb: 'LSP' },
  { datumStart: '2026-03-30', art: 'DFB-Maßnahme', eventTyp: 'Spiel', titel: 'Polen - Deutschland (LSP)', jahrgang: 'U20', gegner: 'Polen', wettbewerb: 'LSP' },
  { datumStart: '2026-04-12', datumEnde: '2026-04-15', art: 'DFB-Maßnahme', eventTyp: 'Camp', titel: 'Torwart-Camp', jahrgang: 'U20' },
  
  // U19
  { datumStart: '2026-03-01', datumEnde: '2026-03-04', art: 'DFB-Maßnahme', eventTyp: 'Lehrgang', titel: 'Lehrgang', jahrgang: 'U19' },
  { datumStart: '2026-03-22', datumEnde: '2026-04-01', art: 'DFB-Maßnahme', eventTyp: 'Turnier', titel: '2. Runde EM-Qualifikation', jahrgang: 'U19', ort: 'Deutschland' },
  { datumStart: '2026-03-25', art: 'DFB-Maßnahme', eventTyp: 'Spiel', titel: 'Deutschland - Schweden (EMQ)', jahrgang: 'U19', gegner: 'Schweden', wettbewerb: 'EMQ' },
  { datumStart: '2026-03-28', art: 'DFB-Maßnahme', eventTyp: 'Spiel', titel: 'Deutschland - Griechenland (EMQ)', jahrgang: 'U19', gegner: 'Griechenland', wettbewerb: 'EMQ' },
  { datumStart: '2026-03-31', art: 'DFB-Maßnahme', eventTyp: 'Spiel', titel: 'Österreich - Deutschland (EMQ)', jahrgang: 'U19', gegner: 'Österreich', wettbewerb: 'EMQ' },
  { datumStart: '2026-04-12', datumEnde: '2026-04-15', art: 'DFB-Maßnahme', eventTyp: 'Camp', titel: 'Torwart-Camp', jahrgang: 'U19' },
  { datumStart: '2026-05-24', datumEnde: '2026-05-28', art: 'DFB-Maßnahme', eventTyp: 'Lehrgang', titel: 'Lehrgang mit Länderspiel', jahrgang: 'U19' },
  { datumStart: '2026-06-16', datumEnde: '2026-06-22', art: 'DFB-Maßnahme', eventTyp: 'Lehrgang', titel: 'EM-Vorbereitungslehrgang', jahrgang: 'U19' },
  { datumStart: '2026-06-25', datumEnde: '2026-07-12', art: 'DFB-Maßnahme', eventTyp: 'Turnier', titel: 'Europameisterschaft', jahrgang: 'U19', ort: 'Wales' },
  
  // U18
  { datumStart: '2026-03-01', datumEnde: '2026-03-04', art: 'DFB-Maßnahme', eventTyp: 'Lehrgang', titel: 'Lehrgang', jahrgang: 'U18', ort: 'DFB-Campus' },
  { datumStart: '2026-03-24', datumEnde: '2026-04-01', art: 'DFB-Maßnahme', eventTyp: 'Turnier', titel: 'EM-Qualifikation', jahrgang: 'U18', ort: 'Österreich' },
  { datumStart: '2026-03-25', art: 'DFB-Maßnahme', eventTyp: 'Spiel', titel: 'Deutschland - Bosnien-Herzegowina (EMQ)', jahrgang: 'U18', gegner: 'Bosnien-Herzegowina', wettbewerb: 'EMQ' },
  { datumStart: '2026-03-28', art: 'DFB-Maßnahme', eventTyp: 'Spiel', titel: 'Deutschland - Israel (EMQ)', jahrgang: 'U18', gegner: 'Israel', wettbewerb: 'EMQ' },
  { datumStart: '2026-03-31', art: 'DFB-Maßnahme', eventTyp: 'Spiel', titel: 'Österreich - Deutschland (EMQ)', jahrgang: 'U18', gegner: 'Österreich', wettbewerb: 'EMQ' },
  { datumStart: '2026-04-12', datumEnde: '2026-04-15', art: 'DFB-Maßnahme', eventTyp: 'Camp', titel: 'Torwart-Camp', jahrgang: 'U18' },
  { datumStart: '2026-05-24', datumEnde: '2026-05-28', art: 'DFB-Maßnahme', eventTyp: 'Lehrgang', titel: 'Lehrgang mit Länderspiel', jahrgang: 'U18' },
  
  // U17
  { datumStart: '2026-01-04', datumEnde: '2026-01-15', art: 'DFB-Maßnahme', eventTyp: 'Lehrgang', titel: 'Wintertrainingslager', jahrgang: 'U17', ort: 'Pinatar, Spanien' },
  { datumStart: '2026-01-11', zeit: '11:00', art: 'DFB-Maßnahme', eventTyp: 'Spiel', titel: 'Portugal - Deutschland (LSP)', jahrgang: 'U17', ort: 'Pinatar', gegner: 'Portugal', wettbewerb: 'LSP' },
  { datumStart: '2026-01-14', zeit: '16:00', art: 'DFB-Maßnahme', eventTyp: 'Spiel', titel: 'Deutschland - Portugal (LSP)', jahrgang: 'U17', ort: 'Pinatar', gegner: 'Portugal', wettbewerb: 'LSP' },
  { datumStart: '2026-02-09', datumEnde: '2026-02-19', art: 'DFB-Maßnahme', eventTyp: 'Turnier', titel: 'Algarve-Cup', jahrgang: 'U17', ort: 'Portugal' },
  { datumStart: '2026-02-13', art: 'DFB-Maßnahme', eventTyp: 'Spiel', titel: 'Portugal - Deutschland', jahrgang: 'U17', ort: 'Portugal', gegner: 'Portugal' },
  { datumStart: '2026-02-15', art: 'DFB-Maßnahme', eventTyp: 'Spiel', titel: 'Deutschland - Dänemark', jahrgang: 'U17', ort: 'Portugal', gegner: 'Dänemark' },
  { datumStart: '2026-02-18', art: 'DFB-Maßnahme', eventTyp: 'Spiel', titel: 'Spanien - Deutschland', jahrgang: 'U17', ort: 'Portugal', gegner: 'Spanien' },
  { datumStart: '2026-03-20', datumEnde: '2026-03-22', art: 'DFB-Maßnahme', eventTyp: 'Lehrgang', titel: 'Vorbereitungslehrgang', jahrgang: 'U17' },
  { datumStart: '2026-03-24', datumEnde: '2026-04-01', art: 'DFB-Maßnahme', eventTyp: 'Turnier', titel: '2. Runde EM-Qualifikation', jahrgang: 'U17', ort: 'Slowenien' },
  { datumStart: '2026-03-25', art: 'DFB-Maßnahme', eventTyp: 'Spiel', titel: 'Deutschland - Nordmazedonien (EMQ)', jahrgang: 'U17', ort: 'Slowenien', gegner: 'Nordmazedonien', wettbewerb: 'EMQ' },
  { datumStart: '2026-03-28', art: 'DFB-Maßnahme', eventTyp: 'Spiel', titel: 'Deutschland - Slowenien (EMQ)', jahrgang: 'U17', ort: 'Slowenien', gegner: 'Slowenien', wettbewerb: 'EMQ' },
  { datumStart: '2026-03-31', art: 'DFB-Maßnahme', eventTyp: 'Spiel', titel: 'Frankreich - Deutschland (EMQ)', jahrgang: 'U17', ort: 'Slowenien', gegner: 'Frankreich', wettbewerb: 'EMQ' },
  { datumStart: '2026-04-12', datumEnde: '2026-04-15', art: 'DFB-Maßnahme', eventTyp: 'Camp', titel: 'Torwart-Camp', jahrgang: 'U17' },
  { datumStart: '2026-05-18', datumEnde: '2026-05-24', art: 'DFB-Maßnahme', eventTyp: 'Lehrgang', titel: 'EM-Vorbereitung', jahrgang: 'U17' },
  { datumStart: '2026-05-25', datumEnde: '2026-06-08', art: 'DFB-Maßnahme', eventTyp: 'Turnier', titel: 'Europameisterschaft', jahrgang: 'U17', ort: 'Estland' },
  // NEU: U17 November 2026
  { datumStart: '2026-11-10', datumEnde: '2026-11-18', art: 'DFB-Maßnahme', eventTyp: 'Turnier', titel: 'EM-Qualifikation', jahrgang: 'U17' },
  { datumStart: '2026-11-11', art: 'DFB-Maßnahme', eventTyp: 'Spiel', titel: 'Deutschland - Nordirland (EMQ)', jahrgang: 'U17', gegner: 'Nordirland', wettbewerb: 'EMQ' },
  { datumStart: '2026-11-14', art: 'DFB-Maßnahme', eventTyp: 'Spiel', titel: 'Deutschland - Litauen (EMQ)', jahrgang: 'U17', gegner: 'Litauen', wettbewerb: 'EMQ' },
  { datumStart: '2026-11-17', art: 'DFB-Maßnahme', eventTyp: 'Spiel', titel: 'Deutschland - Aserbaidschan (EMQ)', jahrgang: 'U17', gegner: 'Aserbaidschan', wettbewerb: 'EMQ' },
  
  // U16
  { datumStart: '2026-01-04', datumEnde: '2026-01-15', art: 'DFB-Maßnahme', eventTyp: 'Lehrgang', titel: 'Wintertrainingslager', jahrgang: 'U16', ort: 'Pinatar, Spanien' },
  { datumStart: '2026-01-11', zeit: '16:00', art: 'DFB-Maßnahme', eventTyp: 'Spiel', titel: 'Portugal - Deutschland (LSP)', jahrgang: 'U16', ort: 'Pinatar', gegner: 'Portugal', wettbewerb: 'LSP' },
  { datumStart: '2026-01-14', zeit: '11:00', art: 'DFB-Maßnahme', eventTyp: 'Spiel', titel: 'Deutschland - Portugal (LSP)', jahrgang: 'U16', ort: 'Pinatar', gegner: 'Portugal', wettbewerb: 'LSP' },
  { datumStart: '2026-02-08', datumEnde: '2026-02-18', art: 'DFB-Maßnahme', eventTyp: 'Turnier', titel: 'Turnier', jahrgang: 'U16', ort: 'Portugal' },
  { datumStart: '2026-03-23', datumEnde: '2026-03-31', art: 'DFB-Maßnahme', eventTyp: 'Lehrgang', titel: 'Lehrgang mit zwei Länderspielen gegen Italien', jahrgang: 'U16', gegner: 'Italien' },
  { datumStart: '2026-04-12', datumEnde: '2026-04-15', art: 'DFB-Maßnahme', eventTyp: 'Camp', titel: 'Torwart-Camp', jahrgang: 'U16' },
  { datumStart: '2026-05-12', datumEnde: '2026-05-13', art: 'DFB-Maßnahme', eventTyp: 'Lehrgang', titel: 'Lehrgang U17-Perspektivkader', jahrgang: 'U16' },
  { datumStart: '2026-05-14', datumEnde: '2026-05-19', art: 'DFB-Maßnahme', eventTyp: 'Sichtung', titel: 'Sichtungsturnier', jahrgang: 'U16', ort: 'Duisburg' },
  { datumStart: '2026-05-24', datumEnde: '2026-05-27', art: 'DFB-Maßnahme', eventTyp: 'Lehrgang', titel: 'Lehrgang', jahrgang: 'U16', ort: 'DFB-Campus' },
  { datumStart: '2026-06-07', datumEnde: '2026-06-11', art: 'DFB-Maßnahme', eventTyp: 'Lehrgang', titel: 'Lehrgang mit Länderspiel', jahrgang: 'U16' },
  
  // U15
  { datumStart: '2026-03-15', datumEnde: '2026-03-20', art: 'DFB-Maßnahme', eventTyp: 'Lehrgang', titel: 'Lehrgang', jahrgang: 'U15', ort: 'DFB-Campus' },
  { datumStart: '2026-03-22', datumEnde: '2026-03-27', art: 'DFB-Maßnahme', eventTyp: 'Lehrgang', titel: 'Lehrgang', jahrgang: 'U15', ort: 'DFB-Campus' },
  { datumStart: '2026-04-12', datumEnde: '2026-04-15', art: 'DFB-Maßnahme', eventTyp: 'Camp', titel: 'Torwart-Camp', jahrgang: 'U15' },
  { datumStart: '2026-04-20', datumEnde: '2026-04-23', art: 'DFB-Maßnahme', eventTyp: 'Lehrgang', titel: 'Lehrgang', jahrgang: 'U15' },
  { datumStart: '2026-05-03', datumEnde: '2026-05-09', art: 'DFB-Maßnahme', eventTyp: 'Lehrgang', titel: 'Lehrgang mit Länderspiel', jahrgang: 'U15' },
  { datumStart: '2026-05-28', datumEnde: '2026-06-02', art: 'DFB-Maßnahme', eventTyp: 'Sichtung', titel: 'Sichtungsturnier', jahrgang: 'U15', ort: 'Duisburg' },
  { datumStart: '2026-06-11', datumEnde: '2026-06-16', art: 'DFB-Maßnahme', eventTyp: 'Sichtung', titel: 'U14-Sichtungsturnier', jahrgang: 'U15', ort: 'Bad Blankenberg' },
  { datumStart: '2026-06-18', datumEnde: '2026-06-23', art: 'DFB-Maßnahme', eventTyp: 'Sichtung', titel: 'U14-Sichtungsturnier', jahrgang: 'U15', ort: 'Kaiserau' },
];

export function getRelevantTermine(): DFBTermin[] {
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  return DFB_TERMINE.filter(t => {
    const relevantDate = t.datumEnde ? new Date(t.datumEnde) : new Date(t.datumStart);
    return relevantDate >= oneDayAgo;
  }).sort((a, b) => new Date(a.datumStart).getTime() - new Date(b.datumStart).getTime());
}

export function formatDatumDisplay(termin: DFBTermin): string {
  const start = new Date(termin.datumStart);
  if (termin.datumEnde && termin.datumEnde !== termin.datumStart) {
    const end = new Date(termin.datumEnde);
    const startStr = start.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
    const endStr = end.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    return `${startStr} - ${endStr}`;
  }
  return start.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function convertToDbFormat(dfbTermin: DFBTermin, erstelltVon: string) {
  const datumStart = dfbTermin.zeit 
    ? `${dfbTermin.datumStart}T${dfbTermin.zeit}:00` 
    : `${dfbTermin.datumStart}T00:00:00`;
  return {
    datum: datumStart,
    datum_ende: dfbTermin.datumEnde || null,
    art: dfbTermin.art,
    event_typ: dfbTermin.eventTyp,
    titel: dfbTermin.titel,
    jahrgang: dfbTermin.jahrgang,
    ort: dfbTermin.ort || null,
    uebernahme_advisor_id: null,
    erstellt_von: erstelltVon,
    quelle: 'DFB',
  };
}

export function getTerminKey(termin: DFBTermin): string {
  return `${termin.datumStart}_${termin.jahrgang}_${termin.titel}`;
}

export function getLastUpdateDisplay(): string {
  const date = new Date(DFB_LAST_UPDATE);
  return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
