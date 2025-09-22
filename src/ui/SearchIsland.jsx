import { useEffect, useRef, useState } from "react";

export default function SearchIsland({ brands }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [filters, setFilters] = useState({ brand: new Set() });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [brandsState, setBrandsState] = useState([]);
  const [totalMatches, setTotalMatches] = useState(0);
  const fuseRef = useRef(null);
  const dataRef = useRef([]);
  const ensureDataPromiseRef = useRef(null);

  // Fold accents/diacritics for accent-insensitive search
  function fold(text) {
    if (typeof text !== "string") return "";
    // NFD splits accents, then remove combining marks
    return text
      .normalize("NFD")
      .replace(/\p{Diacritic}+/gu, "")
      .toLowerCase();
  }
  function withFoldedFields(item) {
    return {
      ...item,
      name_fold: fold(item.name),
      brand_name_fold: fold(item.brand_name),
      perfumer_names_fold: Array.isArray(item.perfumer_names)
        ? item.perfumer_names.map(fold)
        : [],
      notes_fold: Array.isArray(item.notes) ? item.notes.map(fold) : [],
    };
  }

  async function ensureData() {
    if (dataRef.current.length > 0) return;
    if (ensureDataPromiseRef.current) {
      await ensureDataPromiseRef.current;
      return;
    }
    ensureDataPromiseRef.current = (async () => {
      try {
        setLoading(true);
        setError(null);
        // Ensure we have brands before fetching fragrance shards
        let ensuredBrands = brandsState;
        if (!Array.isArray(ensuredBrands) || ensuredBrands.length === 0) {
          // Try to use incoming prop if it's a Set or array-like
          let candidate = brands;
          if (
            candidate &&
            !Array.isArray(candidate) &&
            typeof candidate[Symbol.iterator] === "function"
          ) {
            candidate = Array.from(candidate);
          }
          if (
            !Array.isArray(candidate) ||
            candidate.length === 0 ||
            !candidate[0]?.slug
          ) {
            try {
              candidate = await fetch(`/data/brands.json`).then((r) =>
                r.json()
              );
            } catch (e) {
              setError("Failed to load brands list.");
              candidate = [];
            }
          }
          ensuredBrands = candidate;
          setBrandsState(candidate);
        }
        const shardErrors = [];
        const brandItems = await Promise.all(
          ensuredBrands.map(async (b) => {
            try {
              const r = await fetch(`/data/fragrances-${b.slug}.json`);
              return await r.json();
            } catch (e) {
              shardErrors.push(b.slug);
              return [];
            }
          })
        );
        if (shardErrors.length > 0) {
          setError(
            `Failed to load data for: ${shardErrors.join(
              ", "
            )}. Results may be incomplete.`
          );
        }
        const items = brandItems.flat();
        // Store original plus folded fields for accent-insensitive search
        dataRef.current = items.map(withFoldedFields);
      } catch (e) {
        setError("Failed to load fragrance data.");
      } finally {
        setLoading(false);
        ensureDataPromiseRef.current = null;
      }
    })();
    await ensureDataPromiseRef.current;
  }

  async function ensureFuse() {
    if (fuseRef.current) return;
    const { default: Fuse } = await import("fuse.js");
    fuseRef.current = new Fuse(dataRef.current, {
      includeScore: false,
      ignoreLocation: true,
      threshold: 0.3,
      keys: [
        { name: "name_fold", weight: 3 },
        { name: "brand_name_fold", weight: 2 },
        { name: "perfumer_names_fold", weight: 1.5 },
        { name: "notes_fold", weight: 1.5 },
        { name: "year", weight: 0.5 },
      ],
    });
  }

  // Prefetch data on mount and when `brands` prop changes; reset caches on change
  useEffect(() => {
    (async () => {
      // If incoming brands prop is provided/changes, normalize and use it
      let candidate = brands;
      if (
        candidate &&
        !Array.isArray(candidate) &&
        typeof candidate[Symbol.iterator] === "function"
      ) {
        candidate = Array.from(candidate);
      }
      if (Array.isArray(candidate) && candidate.length && candidate[0]?.slug) {
        setBrandsState(candidate);
        // Reset caches when brands payload changes
        dataRef.current = [];
        fuseRef.current = null;
        setResults([]);
        setTotalMatches(0);
        setError(null);
        ensureDataPromiseRef.current = null;
      } else if (!brandsState || brandsState.length === 0) {
        // Fall back to client fetch for brands on first load
        try {
          const fetchedBrands = await fetch(`/data/brands.json`).then((r) =>
            r.json()
          );
          setBrandsState(fetchedBrands);
        } catch {
          // ignore; surfaced by ensureData when it fetches shards
        }
      }
      await ensureData();
      if (dataRef.current.length) {
        const base = filters.brand.size
          ? dataRef.current.filter((item) => filters.brand.has(item.brand_slug))
          : dataRef.current;
        setTotalMatches(base.length);
        setResults(base.slice(0, 50));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brands]);

  useEffect(() => {
    (async () => {
      // Ensure base data exists
      await ensureData();
      const base = filters.brand.size
        ? dataRef.current.filter((item) => filters.brand.has(item.brand_slug))
        : dataRef.current;
      if (!q) {
        setTotalMatches(base.length);
        setResults(base.slice(0, 50));
        return;
      }
      // Only load and build Fuse when searching
      await ensureFuse();
      const fuse = fuseRef.current;
      const qFold = q ? fold(q) : q;
      const matches = fuse.search(qFold).map((r) => r.item);
      const merged = matches.filter((m) =>
        filters.brand.size ? filters.brand.has(m.brand_slug) : true
      );
      setTotalMatches(merged.length);
      setResults(merged.slice(0, 50));
    })();
  }, [q, filters]);

  return (
    <div className="grid gap-3">
      <input
        placeholder="Search fragrances, notes, perfumers…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <div>
        <label>Brand</label>
        <select
          value={[...filters.brand][0] ?? ""}
          onChange={(e) => {
            const value = e.target.value;
            const s = value ? new Set([value]) : new Set();
            setFilters({ ...filters, brand: s });
          }}
        >
          <option value="">All</option>
          {brandsState.map((b) => (
            <option key={b.slug} value={b.slug}>
              {b.name}
            </option>
          ))}
        </select>
      </div>
      {error && <div role="alert">{error}</div>}
      {!error && loading && results.length === 0 && <div>Loading…</div>}
      {!loading && !error && results.length > 0 && (
        <div>
          {totalMatches > 50
            ? `Showing ${results.length} of ${totalMatches}`
            : `Showing ${totalMatches} results`}
        </div>
      )}
      {!loading && !error && results.length === 0 && (
        <div>No results yet. Type to search or choose a brand.</div>
      )}
      <ul>
        {results.map((r) => (
          <li key={r.slug}>
            <a href={`/fragrance/${r.slug}`}>{r.name}</a> — {r.brand_name} (
            {r.year})
          </li>
        ))}
      </ul>
    </div>
  );
}
