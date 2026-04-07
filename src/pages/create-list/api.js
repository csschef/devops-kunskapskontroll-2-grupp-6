import { supabase } from "../../api-service.js";

export async function searchStores({ storeName, city }) {
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
  if (!storeId) {
    return [];
  }

  // Derive ranked output from store_layouts to avoid dependency on optional SQL views.
  const layouts = await loadStoreLayouts(storeId);

  return [...layouts]
    .map((layout) => ({
      ...layout,
      usage_count: Number(layout.usage_count ?? 0),
    }))
    .sort((a, b) => Number(b.usage_count ?? 0) - Number(a.usage_count ?? 0));
}

export async function getCurrentUserId() {
	// Resolve the signed-in user id; null means guest or auth not ready.
  const { data, error } = await supabase.auth.getUser();

  if (error) {
    return null;
  }

  return data?.user?.id ?? null;
}

export async function createShoppingList({
  storeId,
  layoutId,
  userId,
  title = "Min Inkoplista",
}) {
  const basePayloads = [
    { store_id: storeId, store_layout_id: layoutId, title },
    { store_id: storeId, layout_id: layoutId, title },
    { store_id: storeId, title },
  ];

  const payloadCandidates = basePayloads.flatMap((payload) => {
    if (!userId) {
      return [payload];
    }

    return [
      { ...payload, user_id: userId },
      { ...payload, created_by: userId },
      payload,
    ];
  });

  let lastError = null;

  for (const payload of payloadCandidates) {
    const { data, error } = await supabase
      .from("shopping_lists")
      .insert(payload)
      .select("id")
      .single();

    if (!error && data?.id) {
      return data.id;
    }

    if (error) {
      lastError = error;
    }
  }

  if (lastError) {
    throw lastError;
  }

  throw new Error("Failed to create shopping list.");
}
