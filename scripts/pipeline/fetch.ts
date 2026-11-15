/**
 * Pipeline, stage 1: what is fetched for one country. The inputs are curated (PRD §6.3, D11): the
 * Wikidata items of the country's states and of its head-of-government offices.
 */
import path from "node:path";
import { chunks, fetchRaw, holdersQuery, namesQuery, qid, statementsQuery, type Row } from "./wikidata";

/**
 * Asked of every state: inception, dissolution, capital, form of government, official name, flag,
 * head of state, head of government, and the offices those two hold.
 */
const STATE_PROPS = ["P571", "P576", "P36", "P122", "P1448", "P41", "P35", "P6", "P1906", "P1313"];
const PERSON_PROPS = ["P569", "P570"];

export type Raw = { states: Row[]; holders: Row[]; people: Row[]; names: Row[] };

/** `alsoNamed`: items whose names are wanted although nothing else is fetched about them. */
export async function fetchCountry(dir: string, stateItems: string[], offices: string[], alsoNamed: string[], refresh: boolean): Promise<Raw> {
  const file = (name: string) => path.join(dir, `${name}.json`);
  const states = await fetchRaw(file("states"), [statementsQuery(stateItems, STATE_PROPS)], refresh);
  const holders = offices.length ? await fetchRaw(file("holders"), [holdersQuery(offices)], refresh) : [];

  const isItem = (v?: string) => v?.startsWith("http://www.wikidata.org/entity/Q");
  const people = [
    ...new Set([
      ...states.filter((r) => r.prop === "P35" || r.prop === "P6").map((r) => r.value),
      ...holders.map((r) => r.person),
    ].filter(isItem).map(qid)),
  ].sort();
  const others = [
    ...new Set([...stateItems, ...offices, ...alsoNamed, ...states.filter((r) => ["P36", "P122", "P1906", "P1313"].includes(r.prop) && isItem(r.value)).map((r) => qid(r.value))]),
  ].sort();

  const born = await fetchRaw(file("people"), chunks(people, 200).map((b) => statementsQuery(b, PERSON_PROPS)), refresh);
  const names = await fetchRaw(file("names"), chunks([...others, ...people], 200).map(namesQuery), refresh);
  return { states, holders, people: born, names };
}
