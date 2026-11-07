"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { catalog, defaultSources, latestListings, summarize, type Entry, type Model, type Observation } from "../lib/market";
import SiteHeader from "../components/site-header";
import HomeView from "../components/home-view";
import WatchDetail from "../components/watch-detail";
import RecordModal from "../components/record-modal";
import { BrandsView, CollectionView, RecordsView, SourcesView } from "../components/account-views";
import ClipView from "../components/save-from-web";
import { defaultPrefs, matchesPrefs, parseRoute, routeUrl, type BrandFacet, type LiveListing, type Me, type ModalKind, type Prefs, type Route } from "../components/shared";

const PREFS_KEY = "watchledger:prefs";
const RECENT_KEY = "watchledger:recent-watches";

export default function Home() {
  const [route, setRoute] = useState<Route>({ view: "home" });
  const [ready, setReady] = useState(false);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [me, setMe] = useState<Me | null>(null);
  const [brands, setBrands] = useState<BrandFacet[]>([]);
  const [cache, setCache] = useState<Record<string, Model>>(() => Object.fromEntries(catalog.map((m) => [m.id, m])));
  const [prefs, setPrefsState] = useState<Prefs>(defaultPrefs);
  const [modal, setModal] = useState<ModalKind>("");
  const [recentIds, setRecentIds] = useState<string[]>([]);

  // ---- Routing (query-string based so links and the back button work) ----
  useEffect(() => {
    setRoute(parseRoute(location.search));
    setReady(true);
    try {
      const p = JSON.parse(localStorage.getItem(PREFS_KEY) || "null");
      if (p) setPrefsState({ ...defaultPrefs, ...p });
      setRecentIds(JSON.parse(localStorage.getItem(RECENT_KEY) || "[]"));
    } catch {}
    const onPop = () => setRoute(parseRoute(location.search));
    addEventListener("popstate", onPop);
    return () => removeEventListener("popstate", onPop);
  }, []);
  const navigate = useCallback((r: Route) => {
    const url = routeUrl(r);
    if (url !== location.pathname + location.search) history.pushState(null, "", url);
    setRoute(r);
    scrollTo({ top: 0 });
  }, []);
  const setPrefs = (p: Prefs) => {
    setPrefsState(p);
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(p)); } catch {}
  };

  // ---- Data ----
  useEffect(() => {
    fetch("/api/records")
      .then(async (r) => {
        const body: any = await r.json();
        if (!r.ok) throw new Error(body.error || "Could not load your records");
        setEntries(body);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoaded(true));
    fetch("/api/me").then((r) => r.json()).then((d) => setMe(d as Me)).catch(() => setMe({ user: null }));
    fetch("/api/catalog?facets=brands").then((r) => r.json()).then((d: any) => setBrands(d.brands || [])).catch(() => {});
  }, []);

  const addModels = useCallback((ms: Model[]) => setCache((prev) => ({ ...prev, ...Object.fromEntries(ms.map((m) => [m.id, m])) })), []);

  // Resolve catalog details for watches referenced by records and recent views.
  useEffect(() => {
    const ids = [...new Set([...entries.filter((e) => e.kind === "owned" || e.kind === "observation").map((e) => e.data.modelId as string), ...recentIds])].filter((id) => !cache[id]);
    if (!ids.length) return;
    const controller = new AbortController();
    Promise.all(
      Array.from({ length: Math.ceil(ids.length / 200) }, (_, i) =>
        fetch(`/api/catalog?ids=${encodeURIComponent(ids.slice(i * 200, i * 200 + 200).join(","))}`, { signal: controller.signal }).then((r) => r.json()),
      ),
    )
      .then((groups: any[]) => addModels(groups.flatMap((g) => g.items || [])))
      .catch(() => {});
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, recentIds]);

  // Remember recently viewed watches.
  useEffect(() => {
    if (route.view !== "watch" || !route.id) return;
    setRecentIds((prev) => {
      const next = [route.id!, ...prev.filter((x) => x !== route.id)].slice(0, 12);
      try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, [route]);

  const models = useMemo(
    () => ({ ...cache, ...Object.fromEntries(entries.filter((e) => e.kind === "model").map((e) => [e.id, { ...e.data, id: e.id }])) }) as Record<string, Model>,
    [cache, entries],
  );
  const sources = [...defaultSources, ...entries.filter((e) => e.kind === "source").map((e) => ({ ...e.data, id: e.id }))];
  const sourceName = (id: string) => sources.find((s) => s.id === id)?.name || id;
  const owned = entries.filter((e) => e.kind === "owned");
  const observations = entries.filter((e) => e.kind === "observation") as (Entry & { data: Observation })[];
  const ownedIds = new Set(owned.map((e) => e.data.modelId as string));
  const priceFor = (id: string) => {
    const xs = observations.filter((e) => e.data.modelId === id && matchesPrefs(e.data, prefs));
    return { value: summarize(latestListings(xs).map((e) => e.data.price), prefs.method), count: xs.length };
  };
  const selected = route.view === "watch" && route.id ? route.id : catalog[0].id;
  const modalModels = Object.values(models).sort((a, b) => (a.id === selected ? -1 : b.id === selected ? 1 : 0));

  async function saveRecord(kind: string, data: Record<string, unknown>) {
    const r = await fetch("/api/records", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, data }) });
    const body: any = await r.json();
    if (!r.ok) throw new Error(body.error || "Could not save");
    setEntries((prev) => [...prev, body]);
    if (kind === "model") navigate({ view: "watch", id: body.id });
  }
  async function saveListing(l: LiveListing) {
    const { match: _m, image: _i, ...data } = l;
    try {
      await saveRecord("observation", data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    }
  }
  async function remove(id: string) {
    if (!confirm("Remove this record from your tracker?")) return;
    try {
      const r = await fetch(`/api/records?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!r.ok) throw new Error("Could not remove record");
      setEntries((prev) => prev.filter((e) => e.id !== id));
    } catch (e) {
      setError(String(e));
    }
  }
  function exportData() {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), entries }, null, 2)], { type: "application/json" }));
    a.download = "watchledger-data.json";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const signedIn = Boolean(me?.user) || (loaded && !error.toLowerCase().includes("sign in"));
  const openModal = (k: ModalKind) => {
    if (k && k !== "about" && !me?.user && me) {
      setError("Please sign in to save watches and prices.");
      return;
    }
    setModal(k);
  };

  return (
    <div className="app">
      <SiteHeader route={route} me={me} brands={brands} ownedCount={owned.length} observationCount={observations.length} onNavigate={navigate} onModal={openModal} onExport={exportData} prefs={prefs} onPrefs={setPrefs} />
      <main className="page">
        {error && (
          <div role="alert" className="notice error">
            {error}
            {error.toLowerCase().includes("sign in") && <a href={me?.signInPath || "/signin-with-chatgpt?return_to=%2F"} target="_top">Sign in</a>}
            <button onClick={() => setError("")}>Dismiss</button>
          </div>
        )}
        {!ready ? null : route.view === "watch" && route.id ? (
          <WatchDetail
            key={route.id}
            modelId={route.id}
            model={models[route.id]}
            entries={entries}
            sourceName={sourceName}
            prefs={prefs}
            onPrefs={setPrefs}
            onNavigate={navigate}
            onModal={openModal}
            onSaveListing={saveListing}
            onRemove={remove}
            onModels={addModels}
            signedIn={signedIn}
            onSaveRecord={saveRecord}
            groupSources={sources.filter((s) => /facebook\.com\/groups\//i.test(s.url || ''))}
          />
        ) : route.view === "collection" ? (
          <CollectionView entries={entries} models={models} prefs={prefs} onPrefs={setPrefs} onNavigate={navigate} onModal={openModal} onRemove={remove} />
        ) : route.view === "records" ? (
          <RecordsView entries={entries} models={models} sources={sources} prefs={prefs} onPrefs={setPrefs} onNavigate={navigate} onModal={openModal} onRemove={remove} onExport={exportData} />
        ) : route.view === "sources" ? (
          <SourcesView sources={sources} onModal={openModal} />
        ) : route.view === "clip" ? (
          <ClipView brands={brands} sources={sources} onSave={saveRecord} onNavigate={navigate} />
        ) : route.view === "brands" ? (
          <BrandsView brands={brands} onNavigate={navigate} />
        ) : (
          <HomeView
            route={route}
            brands={brands}
            prefs={prefs}
            onPrefs={setPrefs}
            onNavigate={navigate}
            priceFor={priceFor}
            ownedIds={ownedIds}
            recent={recentIds.map((id) => models[id]).filter(Boolean)}
            ownedModels={[...ownedIds].map((id) => models[id]).filter(Boolean)}
            onModels={addModels}
          />
        )}
      </main>
      <footer className="site-footer">
        <span>WatchLedger · private watch price tracker</span>
        <span>Catalog: Timepiecepedia (CC0) · Live prices: Tori.fi{" "}</span>
        <button onClick={() => openModal("about")}>Data &amp; methodology <ArrowUpRight size={12} /></button>
      </footer>
      {modal && (
        <RecordModal
          kind={modal}
          models={modalModels}
          selected={selected}
          sources={sources}
          currency={prefs.currency}
          onClose={() => setModal("")}
          onOpen={openModal}
          onSave={saveRecord}
        />
      )}
    </div>
  );
}
