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
  title = "Min Inköpslista",
}) {
  const UUID_REGEX =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  const normalizedTitle = String(title ?? "").trim() || "Min Inköpslista";
  const normalizedStoreId = String(storeId ?? "").trim();
  const normalizedLayoutId = String(layoutId ?? "").trim();
  const normalizedUserId = String(userId ?? "").trim();

  if (!UUID_REGEX.test(normalizedStoreId)) {
    throw new Error("Invalid or missing storeId: expected UUID.");
  }

  const payload = {
    title: normalizedTitle,
    store_id: normalizedStoreId,
    layout_id: UUID_REGEX.test(normalizedLayoutId) ? normalizedLayoutId : null,
    user_id: UUID_REGEX.test(normalizedUserId) ? normalizedUserId : null,
  };

  const { data, error } = await supabase
    .from("shopping_lists")
    .insert(payload)
    .select("id")
    .single();

  if (error) {
    console.error("Supabase createShoppingList insert failed", {
      payload,
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });
    throw error;
  }

  if (!data?.id) {
    throw new Error("Shopping list insert succeeded but no id was returned.");
  }

  return data.id;
}
