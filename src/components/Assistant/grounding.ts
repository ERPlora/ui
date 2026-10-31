// What the assistant says, checked against what really ran (BASE-G117; gh:hub#1039): the panel never trusts what an
// answer says of itself. Three notices, painted outside the bubble and never written by the model:
// - `claimed_change`: the answer says the assistant changed something in this turn and no write of the turn ran
//   (none, or cancelled, failed or refused). A claim is the assistant speaking of what IT did: in the first person
//   («he creado», «I created»), or a change reported as done («se ha guardado», «has been created», «ya está creado»,
//   «is now saved»), or how things stay when the answer says it is done («Listo, queda guardado», «Done: the price is
//   updated»). An instruction («Pulsa Guardar y queda guardado»), a step that may already be done («Si ya está creado…»,
//   «Once it has been saved…») and how things work («La diferencia queda guardada para siempre», «the price is updated
//   every night») claim nothing: a how-to answer read from the docs is no change (QA battery 2026-10-31, B25). Read
//   clause by clause: a negation before the verb in the same clause makes it a denial («no he creado el negocio»,
//   «nothing has been saved»), not a claim;
// - `unread_id`: it writes an identifier (a UUID) that no tool of the turn returned and the person did not write;
// - `unknown_screen`: it links a screen this app does not serve (BASE-G114: no «Go to» for it either).
import { linkPaths, parseMarkdown } from './markdown';

export interface Executed {
  name: string;
  kind: 'query' | 'command' | '';
  outcome: 'ok' | 'error' | 'refused' | 'cancelled';
  app?: string;
  /** Where it happened, as the server names it in the person's language (the platform by its screen). */
  app_name?: string;
  /** The platform's screen it happened on, by its key (`assistant.screens.<key>`); none for an app's. */
  screen?: string;
}

export type GroundingNotice = 'claimed_change' | 'unread_id' | 'unknown_screen';

// The assistant says what it did: a claim wherever it stands, next to an instruction or after a «cuando».
const OWN = [
  /\b(he|hemos)\s+(cread[oa]|añadid[oa]|anadid[oa]|actualizad[oa]|cambiad[oa]|modificad[oa]|borrad[oa]|eliminad[oa]|guardad[oa]|anulad[oa]|registrad[oa]|dad[oa] de alta|cobrad[oa]|cerrad[oa]|abiert[oa])\b/i,
  /\b(?:I|we)(?:['’]ve|\s+have)?\s+(created|added|updated|changed|modified|deleted|removed|saved|voided|registered|closed|opened)\b/i,
];
// A change reported as done, with no one saying who did it: a claim unless it is an instruction or a supposition.
const DONE = [
  /\bse\s+ha(n)?\s+(cread[oa]s?|añadid[oa]s?|actualizad[oa]s?|cambiad[oa]s?|modificad[oa]s?|borrad[oa]s?|eliminad[oa]s?|guardad[oa]s?|anulad[oa]s?|registrad[oa]s?)\b/i,
  /\bya\s+est[áa]n?\s+(cread[oa]s?|añadid[oa]s?|anadid[oa]s?|actualizad[oa]s?|cambiad[oa]s?|modificad[oa]s?|guardad[oa]s?|registrad[oa]s?)\b/i,
  /\b(has|have)\s+been\s+(created|added|updated|changed|modified|deleted|removed|saved|voided|registered|closed|opened)\b/i,
  /\b(?:is|are)\s+now\s+(created|added|updated|changed|modified|deleted|removed|saved|voided|registered)\b/i,
];
// How things stay: a claim only when the answer says it is done, in the same clause («ya», «ahora», «now») or in a
// clause or sentence of its own just before («Listo, …», «¡Hecho! …», «Done: …»). «the price is updated every night»
// describes how things are: at the end of its clause only.
const STATE = [
  /\bqueda(n)?\s+(guardad[oa]s?|cread[oa]s?|actualizad[oa]s?|registrad[oa]s?)\b/i,
  /\b(?:is|are)\s+(created|added|updated|changed|modified|deleted|removed|saved|voided|registered)\s*$/i,
];
// A sentence ends at . ! ? or a line break; a clause also at the rest of the punctuation or at «pero» / «but»:
// «No he creado el negocio, pero he actualizado el precio» claims.
const SENTENCE = /[.!?¡¿\n]/;
const CLAUSE = /[.;,:!?¡¿\n—–]|\s(?:pero|but)\s/i;
/** One of `words` as a whole word, by Unicode letters (`\b` takes «á» for a boundary). */
const word = (words: string) => new RegExp(`(?:^|[^\\p{L}\\p{N}])(?:${words})(?![\\p{L}\\p{N}])`, 'iu');
// «sin» / «without» are no denial: «sin problemas se ha guardado» claims a change.
const NEGATION = new RegExp(`${word('no|not|nunca|never|nada|nothing|none|ning[uú]n[oa]?|tampoco').source}|n['’]t(?![\\p{L}\\p{N}])`, 'iu');
// A supposition: the clause and the rest of its sentence say what happens if or when, not what happened.
const SUPPOSITION = word('si|cuando|una vez|en cuanto|hasta que|despu[eé]s de que|a menos que|if|when|once|as soon as|after|until|unless');
// An instruction: a clause that opens with the verb of a step («Pulsa…», «Tap…»).
const INSTRUCTION =
  /^[^\p{L}]*(?:pulsa|pulse|toca|toque|haz|haga|ve|vaya|abre|abra|elige|elija|selecciona|seleccione|escribe|escriba|introduce|introduzca|confirma|confirme|rellena|rellene|añade|añada|busca|busque|comprueba|compruebe|revisa|revise|guarda|guarde|activa|active|desactiva|desactive|indica|indique|configura|configure|press|tap|click|go|open|choose|select|enter|type|confirm|fill|add|search|check|save)(?![\p{L}\p{N}])/iu;
const NOW = word('ya|ahora|now');
const SAYS_DONE = /^[^\p{L}]*(?:listo|lista|listos|listas|hecho|hecha|hechos|hechas|done|all set)[^\p{L}]*$/iu;

/** Where `patterns` hit in `clause`, with no negation before the verb: the text before the hit, or null. */
function hit(patterns: RegExp[], clause: string): string | null {
  for (const pattern of patterns) {
    const found = pattern.exec(clause);
    if (found !== null && !NEGATION.test(clause.slice(0, found.index))) return clause.slice(0, found.index);
  }
  return null;
}

/** Whether some clause says the assistant made a change in this turn (see `claimed_change` above). */
function claimsChange(answer: string): boolean {
  let saidDone = false;
  for (const sentence of answer.split(SENTENCE)) {
    if (sentence.trim() === '') continue;
    let instructed = false;
    let supposed = false;
    let done = saidDone;
    for (const clause of sentence.split(CLAUSE)) {
      if (hit(OWN, clause) !== null) return true;
      instructed ||= INSTRUCTION.test(clause);
      const reported = hit(DONE, clause);
      if (reported !== null && !instructed && !supposed && !SUPPOSITION.test(reported)) return true;
      const state = hit(STATE, clause);
      if (state !== null && !instructed && !supposed && !SUPPOSITION.test(state) && (done || NOW.test(state))) return true;
      supposed ||= SUPPOSITION.test(clause);
      done ||= SAYS_DONE.test(clause);
    }
    saidDone = SAYS_DONE.test(sentence);
  }
  return false;
}
const UUID = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;

export function groundingNotices(input: {
  answer: string;
  executed: Executed[];
  /** What each tool of the turn returned (its JSON). */
  results: string[];
  /** The person's last question. */
  question: string;
  screenExists: (path: string) => boolean;
}): GroundingNotice[] {
  const found: GroundingNotice[] = [];
  const wrote = input.executed.some((row) => row.kind === 'command' && row.outcome === 'ok');
  if (!wrote && claimsChange(input.answer)) found.push('claimed_change');
  const read = `${input.results.join('\n')}\n${input.question}`.toLowerCase();
  const ids = input.answer.match(UUID) ?? [];
  if (ids.some((id) => !read.includes(id.toLowerCase()))) found.push('unread_id');
  if (linkPaths(parseMarkdown(input.answer)).some((path) => !input.screenExists(path))) found.push('unknown_screen');
  return found;
}
