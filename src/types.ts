// Brand type, as used in brands.json and throughout the app
export type Brand = {
  slug: string;
  name: string;
  country_code?: string;
  [key: string]: any;
};

// Fragrance type, as used in fragrances-*.json
export type Fragrance = {
  id: number;
  slug: string;
  name: string;
  brand_slug: string;
  brand_name: string;
  year: number;
  concentration: string;
  gender: string; // e.g. "m", "f", "u"
  country_code: string;
  longevity: string; // e.g. "moderate", "long"
  sillage: string; // e.g. "soft", "moderate", "strong"
  perfumer_names: string[];
  notes: string[];
  description: string;
  similar_slugs: string[];
};

// For search filters in SearchIsland
export type SearchFilters = {
  brand: Set<string>;
};
