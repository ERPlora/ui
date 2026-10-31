// What the assistant says, checked against what really ran (BASE-G117; gh:hub#1039): the panel never trusts what an
// answer says of itself. Three notices, painted outside the bubble and never written by the model:
// - `claimed_change`: the answer says it changed something («he creado…», «has been updated») and no write of the
//   turn ran (none, or cancelled, failed or refused). Read clause by clause: a negation before the verb in the same
//   clause makes it a denial («no he creado el negocio», «nothing has been saved»), not a claim;
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

const CLAIMS = [
  // Spanish: «he creado», «he añadido», «se ha guardado», «queda guardado», «listo, …»
  /\b(he|hemos)\s+(cread[oa]|añadid[oa]|anadid[oa]|actualizad[oa]|cambiad[oa]|modificad[oa]|borrad[oa]|eliminad[oa]|guardad[oa]|anulad[oa]|registrad[oa]|dad[oa] de alta|cobrad[oa]|cerrad[oa]|abiert[oa])\b/i,
  /\bse\s+ha(n)?\s+(cread[oa]s?|añadid[oa]s?|actualizad[oa]s?|cambiad[oa]s?|modificad[oa]s?|borrad[oa]s?|eliminad[oa]s?|guardad[oa]s?|anulad[oa]s?|registrad[oa]s?)\b/i,
  /\bqueda(n)?\s+(guardad[oa]s?|cread[oa]s?|actualizad[oa]s?|registrad[oa]s?)\b/i,
  /\bya\s+est[áa]n?\s+(cread[oa]s?|añadid[oa]s?|anadid[oa]s?|actualizad[oa]s?|cambiad[oa]s?|modificad[oa]s?|guardad[oa]s?|registrad[oa]s?)\b/i,
  // English: «has been created», «I've updated», «I have deleted», «we added», «is now saved», «the price is updated.»
  /\b(has|have)\s+been\s+(created|added|updated|changed|modified|deleted|removed|saved|voided|registered|closed|opened)\b/i,
  /\b(?:I|we)(?:['’]ve|\s+have)?\s+(created|added|updated|changed|modified|deleted|removed|saved|voided|registered|closed|opened)\b/i,
  /\b(?:is|are)\s+now\s+(created|added|updated|changed|modified|deleted|removed|saved|voided|registered)\b/i,
  // At the end of its clause only: «the price is updated every night» describes how things are, not a change.
  /\b(?:is|are)\s+(created|added|updated|changed|modified|deleted|removed|saved|voided|registered)\s*$/i,
];
// A clause ends at punctuation or at «pero» / «but»: «No he creado el negocio, pero he actualizado el precio» claims.
const CLAUSE = /[.;,:!?¡¿\n—–]|\s(?:pero|but)\s/i;
// «sin» / «without» are no denial: «sin problemas se ha guardado» claims a change.
const NEGATION = /(?:^|[^\p{L}\p{N}])(?:no|not|nunca|never|nada|nothing|none|ning[uú]n[oa]?|tampoco)(?![\p{L}\p{N}])|n['’]t(?![\p{L}\p{N}])/iu;

/** Whether some clause says a change was made, with no negation before its verb. */
function claimsChange(answer: string): boolean {
  return answer.split(CLAUSE).some((clause) =>
    CLAIMS.some((claim) => {
      const hit = claim.exec(clause);
      return hit !== null && !NEGATION.test(clause.slice(0, hit.index));
    }),
  );
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
