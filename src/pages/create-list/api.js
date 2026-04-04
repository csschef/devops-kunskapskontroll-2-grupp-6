import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

let localMockModulePromise;

async function getLocalMockModule() {
  if (!localMockModulePromise) {
    localMockModulePromise = import(
      /* @vite-ignore */ "./mock-data.local.js"
    ).catch(() => null);
  }

  return localMockModulePromise;
}

async function searchStoresFromMocks({ storeName, city }) {
  const mockModule = await getLocalMockModule();

  if (!mockModule?.mockStores) {
    return null;
  }

  const trimmedStoreName = storeName.trim().toLowerCase();
  const trimmedCity = city.trim().toLowerCase();

  return mockModule.mockStores
    .filter((store) => {
      const storeNameMatches = !trimmedStoreName
        || String(store.name || "").toLowerCase().includes(trimmedStoreName);
      const cityMatches = !trimmedCity || String(store.city || "").toLowerCase().includes(trimmedCity);
      return storeNameMatches && cityMatches;
    })
    .slice(0, 10);
}

async function findOrCreateStoreFromMocks({ storeName, city }) {
  const mockModule = await getLocalMockModule();

  if (!mockModule?.mockStores) {
    return null;
  }

  const trimmedStoreName = storeName.trim();
  const trimmedCity = city.trim();

  const existingStore = mockModule.mockStores.find(
    (store) => store.name.toLowerCase() === trimmedStoreName.toLowerCase()
      && store.city.toLowerCase() === trimmedCity.toLowerCase(),
  );

  if (existingStore) {
    return existingStore;
  }

  const newStore = {
    id: `local-${Date.now()}`,
    name: trimmedStoreName,
    city: trimmedCity,
  };

  mockModule.mockStores.push(newStore);
  return newStore;
}

async function loadStoreLayoutsFromMocks(storeId) {
  const mockModule = await getLocalMockModule();

  if (!mockModule?.mockLayoutsByStoreId) {
    return null;
  }

  return mockModule.mockLayoutsByStoreId[storeId] ?? [];
}

export async function searchStores({ storeName, city }) {
	// Use local mock data in development when available.
  const mockData = await searchStoresFromMocks({ storeName, city });

  if (mockData) {
    return mockData;
  }

  const trimmedStoreName = storeName.trim();
  const trimmedCity = city.trim();

  if (!trimmedStoreName && !trimmedCity) {
    return [];
  }

  // Build a flexible search query based on the fields the user filled in.
  let query = supabase.from("stores").select("*");

  if (trimmedStoreName) {
    query = query.ilike("name", `%${trimmedStoreName}%`);
  }

  if (trimmedCity) {
    query = query.ilike("city", `%${trimmedCity}%`);
  }

  const { data, error } = await query.limit(10);

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function findOrCreateStore({ storeName, city }) {
	// Try local mock storage first to keep UI flow working without backend.
  const mockStore = await findOrCreateStoreFromMocks({ storeName, city });

  if (mockStore) {
    return mockStore;
  }

  const trimmedStoreName = storeName.trim();
  const trimmedCity = city.trim();

  if (!trimmedStoreName || !trimmedCity) {
    throw new Error("Both store name and city are required.");
  }

  // Reuse an existing store if one already matches name + city.
  const { data: existingStores, error: existingStoreError } = await supabase
    .from("stores")
    .select("*")
    .ilike("name", trimmedStoreName)
    .ilike("city", trimmedCity)
    .limit(1);

  if (existingStoreError) {
    throw existingStoreError;
  }

  if (existingStores?.length) {
    return existingStores[0];
  }

  // No existing match: create a new store row and return it.
  const { data: insertedStore, error: insertError } = await supabase
    .from("stores")
    .insert({
      name: trimmedStoreName,
      city: trimmedCity,
    })
    .select("*")
    .single();

  if (insertError) {
    throw insertError;
  }

  return insertedStore;
}

export async function loadStoreLayouts(storeId) {
	// Return layouts for one store ordered by newest first.
  const mockLayouts = await loadStoreLayoutsFromMocks(storeId);

  if (mockLayouts) {
    return mockLayouts;
  }

  if (!storeId) {
    return [];
  }

  const { data, error } = await supabase
    .from("store_layouts")
    .select("*")
    .eq("store_id", storeId)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function getStoreLayoutsRanked(storeId) {
	// Read ranked layout usage so popular layouts can be shown first.
  const mockLayouts = await loadStoreLayoutsFromMocks(storeId);

  if (mockLayouts) {
    return mockLayouts.map((layout) => ({
      ...layout,
      usage_count: Number(layout.usage_count ?? 0),
    }));
  }

  if (!storeId) {
    return [];
  }

  const { data, error } = await supabase
    .from("store_layouts_ranked")
    .select("*")
    .eq("store_id", storeId)
    .order("usage_count", { ascending: false });

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function getCurrentUserId() {
	// Resolve the signed-in user id; null means guest or auth not ready.
  const { data, error } = await supabase.auth.getUser();

  if (error) {
    return null;
  }

  return data?.user?.id ?? null;
}
