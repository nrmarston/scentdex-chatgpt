import { useEffect, useRef, useState } from "react";

export default function SearchIsland({ brands }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [filters, setFilters] = useState({ brand: new Set() });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [brandsState, setBrandsState] = useState([]);
  const fuseRef = useRef(null);
  const dataRef = useRef([]);

  async function ensureDataAndFuse() {
    if (!fuseRef.current) {
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
            candidate = await fetch(`/data/brands.json`)
              .then((r) => r.json())
              .catch(() => []);
          }
          ensuredBrands = candidate;
          setBrandsState(candidate);
        }
        const [{ default: Fuse }, ...brandItems] = await Promise.all([
          import("fuse.js"),
          ...ensuredBrands.map((b) =>
            fetch(`/data/fragrances-${b.slug}.json`)
              .then((r) => r.json())
              .catch(() => [])
          ),
        ]);
        const items = brandItems.flat();
        dataRef.current = items;
        fuseRef.current = new Fuse(items, {
          includeScore: false,
          ignoreLocation: true,
          threshold: 0.3,
          keys: [
            { name: "name", weight: 3 },
            { name: "brand_name", weight: 2 },
            { name: "perfumer_names", weight: 1.5 },
            { name: "notes", weight: 1.5 },
            { name: "year", weight: 0.5 },
          ],
        });
      } catch (e) {
        setError("Failed to load fragrance data.");
      } finally {
        setLoading(false);
      }
    }
  }

  // Prefetch data on mount and show some initial items
  useEffect(() => {
    (async () => {
      // Ensure brands are available for the dropdown
      if (!brandsState || brandsState.length === 0) {
        try {
          const fetchedBrands = await fetch(`/data/brands.json`).then((r) =>
            r.json()
          );
          setBrandsState(fetchedBrands);
        } catch {
          // ignore, error will be surfaced by ensureDataAndFuse when it fetches shards
        }
      }
      await ensureDataAndFuse();
      if (dataRef.current.length) {
        setResults(dataRef.current.slice(0, 50));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    (async () => {
      await ensureDataAndFuse();
      const base = filters.brand.size
        ? dataRef.current.filter((item) => filters.brand.has(item.brand_slug))
        : dataRef.current;
      if (!q) {
        setResults(base.slice(0, 50));
        return;
      }
      const fuse = fuseRef.current;
      const matches = fuse.search(q).map((r) => r.item);
      const merged = matches.filter((m) =>
        filters.brand.size ? filters.brand.has(m.brand_slug) : true
      );
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
        <div>{results.length} results</div>
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
