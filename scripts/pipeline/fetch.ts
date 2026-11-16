/**
 * Pipeline, stage 1: what is fetched for one country. The inputs are curated (PRD §6.3, D11): the
 * Wikidata items of the country's states and of its head-of-state and head-of-government offices,
 * and the Commons files of its flags.
 */
import path from "node:path";
import { chunks, fetchCommons, fetchNames, fetchRaw, fetchedAt, holdersQuery, qid, statementsQuery, type Row } from "./wikidata";

/**
 * Asked of every state: inception, dissolution, capital, form of government, official name, flag,
 * head of state, head of government, and the offices those two hold.
 */
const STATE_PROPS = ["P571", "P576", "P36", "P122", "P1448", "P41", "P35", "P6", "P1906", "P1313"];
/** Asked of every person: birth, death, and family (the dynasty, which tells one country's shahs from another's). */
const PERSON_PROPS = ["P569", "P570", "P53"];

export type Raw = { states: Row[]; holders: Row[]; people: Row[]; names: Row[]; flags: Row[]; flagsRetrieved: string };

/** `knownPeople`: people the curated file names, whose names and years are wanted even if no statement mentions them. */
export async function fetchCountry(dir: string, stateItems: string[], offices: string[], knownPeople: string[], flagFiles: string[], refresh: boolean): Promise<Raw> {
  const file = (name: string) => path.join(dir, `${name}.json`);
  const states = await fetchRaw(file("states"), [statementsQuery(stateItems, STATE_PROPS)], refresh);
  const holders = offices.length ? await fetchRaw(file("holders"), [holdersQuery(offices)], refresh) : [];

  const isItem = (v?: string) => v?.startsWith("http://www.wikidata.org/entity/Q");
  const people = [
    ...new Set([
      ...states.filter((r) => r.prop === "P35" || r.prop === "P6").map((r) => r.value),
      ...holders.map((r) => r.person),
    ].filter(isItem).map(qid).concat(knownPeople)),
  ].sort();
  const born = await fetchRaw(file("people"), chunks(people, 200).map((b) => statementsQuery(b, PERSON_PROPS)), refresh);
  const others = [
    ...new Set([
      ...stateItems,
      ...offices,
      ...states.filter((r) => ["P36", "P122", "P1906", "P1313"].includes(r.prop) && isItem(r.value)).map((r) => qid(r.value)),
      // What an "acting" or "interim" qualifier is called.
      ...[...states, ...holders].filter((r) => isItem(r.nature)).map((r) => qid(r.nature)),
    ]),
  ].sort();
  const names = await fetchNames(file("names"), [...others, ...people], refresh);
  const flags = flagFiles.length ? await fetchCommons(file("flags"), flagFiles, refresh) : [];
  return { states, holders, people: born, names, flags, flagsRetrieved: flagFiles.length ? await fetchedAt(file("flags")) : "" };
}
