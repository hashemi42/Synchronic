"use client";

import { useEffect, useSyncExternalStore } from "react";
import type { CountryFile } from "@/lib/data/schema";

/**
 * Country files loaded in this tab, shared by every component. The page seeds
 * it with the default lanes; others are fetched when a lane needs them. The
 * files were validated when they were built, so they are not parsed again here.
 */
const cache = new Map<string, CountryFile>();
const pending = new Map<string, Promise<unknown>>();
const failed = new Set<string>();
const listeners = new Set<() => void>();
let version = 0;

const emit = () => {
  version++;
  listeners.forEach((listener) => listener());
};

function load(id: string, url: string) {
  if (cache.has(id) || pending.has(id)) return;
  failed.delete(id);
  const request = fetch(url)
    .then((res) => {
      if (!res.ok) throw new Error(`${url}: ${res.status}`);
      return res.json() as Promise<CountryFile>;
    })
    .then((file) => cache.set(id, file))
    .catch(() => failed.add(id))
    .finally(() => {
      pending.delete(id);
      emit();
    });
  pending.set(id, request);
}

export function seedCountryFiles(files: CountryFile[]) {
  for (const file of files) if (!cache.has(file.country.id)) cache.set(file.country.id, file);
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** The files for `ids` that have arrived, and the ids that could not be loaded. */
export function useCountryFiles(ids: string[], urls: Record<string, string>) {
  useSyncExternalStore(subscribe, () => version, () => version);

  const key = ids.join(",");
  useEffect(() => {
    for (const id of key.split(",")) if (urls[id]) load(id, urls[id]);
  }, [key, urls]);

  return {
    files: ids.map((id) => cache.get(id)).filter((f): f is CountryFile => f !== undefined),
    failed: ids.filter((id) => failed.has(id)),
    retry: (id: string) => {
      failed.delete(id);
      if (urls[id]) load(id, urls[id]);
    },
  };
}

/** Starts loading a country before it is added, e.g. while it is highlighted in the dialog. */
export function prefetchCountryFile(id: string, url: string | undefined) {
  if (url) load(id, url);
}
