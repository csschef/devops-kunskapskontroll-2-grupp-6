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
    .eq("store_id", storeId);

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function getStoreLayoutsRanked(storeId) {
  if (!storeId) {
    return [];
  }

  const layouts = await loadStoreLayouts(storeId);
  const layoutIds = layouts
    .map((layout) => String(layout?.id ?? "").trim())
    .filter(Boolean);

  let usedLayoutIds = new Set();

  if (layoutIds.length) {
    const { data: usageRows, error: usageError } = await supabase
      .from("shopping_lists")
      .select("layout_id")
      .in("layout_id", layoutIds);

    if (usageError) {
      throw usageError;
    }

    usedLayoutIds = new Set(
      (usageRows ?? [])
        .map((row) => String(row?.layout_id ?? "").trim())
        .filter(Boolean),
    );
  }

  const { data: authData } = await supabase.auth.getUser();
  const authUser = authData?.user ?? null;
  const authUserId = String(authUser?.id ?? "").trim();
  let authUserName = String(
    authUser?.user_metadata?.name
      ?? authUser?.user_metadata?.full_name
      ?? "",
  ).trim();

  if (authUserId && !authUserName) {
    const { data: ownProfile } = await supabase
      .from("profiles")
      .select("id, name")
      .eq("id", authUserId)
      .maybeSingle();

    authUserName = String(ownProfile?.name ?? "").trim();
  }

  const enrichedLayouts = await Promise.all(
    layouts.map(async (layout) => {
      const creatorId = String(layout?.created_by ?? "").trim();
      let authorName = "";

      if (creatorId) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("id, name")
          .eq("id", creatorId)
          .maybeSingle();

        authorName = String(profile?.name ?? "").trim();

        if (!authorName && creatorId === authUserId) {
          authorName = authUserName;
        }
      }

      return {
        ...layout,
        usage_count: usedLayoutIds.has(String(layout?.id ?? "").trim()) ? 1 : 0,
        author_name: authorName,
      };
    }),
  );

  return [...enrichedLayouts]
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
    { store_id: storeId, store_layout_id: layoutId, name: title },
    { store_id: storeId, layout_id: layoutId, name: title },
    { store_id: storeId, title },
    { store_id: storeId, name: title },
    { store_id: storeId },
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
