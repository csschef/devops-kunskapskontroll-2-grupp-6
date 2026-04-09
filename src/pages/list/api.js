import { supabase } from "../../api-service.js";

const LIST_REFERENCE_COLUMNS = ["shopping_list_id"];
export const LIST_ACCESS_ERROR_CODES = Object.freeze({
  UNAUTHENTICATED: "LIST_ACCESS_UNAUTHENTICATED",
  NOT_FOUND: "LIST_ACCESS_NOT_FOUND",
  FORBIDDEN: "LIST_ACCESS_FORBIDDEN",
});

export const LIST_SHARE_ERROR_CODES = Object.freeze({
  NOT_OWNER: "LIST_SHARE_NOT_OWNER",
  INVALID_EMAIL: "LIST_SHARE_INVALID_EMAIL",
  USER_NOT_FOUND: "LIST_SHARE_USER_NOT_FOUND",
  ALREADY_MEMBER: "LIST_SHARE_ALREADY_MEMBER",
  OWNER_CANNOT_BE_MEMBER: "LIST_SHARE_OWNER_CANNOT_BE_MEMBER",
  CANNOT_REMOVE_OWNER: "LIST_SHARE_CANNOT_REMOVE_OWNER",
  INVALID_USER: "LIST_SHARE_INVALID_USER",
});

const CATEGORY_LABEL_BY_SLUG = {
  "frukt-gront": "Frukt & Grönt",
  "brod-bakverk": "Bröd & Bakverk",
  "kott-fagel": "Kött & Fågel",
  "fisk-skaldjur": "Fisk & Skaldjur",
  "chark-palagg": "Chark & Pålägg",
  "mejeri-agg": "Mejeri & Ägg",
  "frysvaror": "Frysvaror",
  "torrvaror": "Torrvaror",
  "hygien-hushall": "Hygien & Hushåll",
  "dryck": "Dryck",
  "snacks-godis": "Snacks & Godis",
  "ovrigt": "Övrigt",
};

const productCacheById = new Map();
const categoryCacheById = new Map();

function getFirstTruthyValue(record, keys) {
  for (const key of keys) {
    if (record && record[key] !== undefined && record[key] !== null) {
      return record[key];
    }
  }

  return null;
}

function getItemListId(item) {
  return getFirstTruthyValue(item, LIST_REFERENCE_COLUMNS);
}

function getRealtimePayloadListId(payload) {
  const row = payload?.new ?? payload?.old ?? null;

  return String(
    getFirstTruthyValue(row, [
      ...LIST_REFERENCE_COLUMNS,
      "list_id",
      "shoppingListId",
    ]) ?? "",
  ).trim();
}

function normalizeCategorySlug(value) {
  return String(value ?? "")
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_\s]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function toTitleCaseFromSlug(value) {
  return normalizeCategorySlug(value)
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function normalizeCategoryName(value) {
  const normalizedSlug = normalizeCategorySlug(value);

  if (!normalizedSlug) {
    return "Diverse";
  }

  if (CATEGORY_LABEL_BY_SLUG[normalizedSlug]) {
    return CATEGORY_LABEL_BY_SLUG[normalizedSlug];
  }

  return toTitleCaseFromSlug(normalizedSlug) || "Diverse";
}

function createListAccessError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function createListShareError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function requireSupabaseClient() {
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }
}

async function getCurrentUserId() {
  requireSupabaseClient();

  const { data, error } = await supabase.auth.getUser();

  if (error) {
    throw error;
  }

  return data?.user?.id ?? null;
}

async function getListAccessContext(listId, userId) {
  const trimmedListId = String(listId ?? "").trim();

  if (!trimmedListId) {
    return {
      listExists: false,
      hasAccess: false,
      isOwner: false,
      isMember: false,
      ownerId: null,
    };
  }

  const { data: listRecord, error: listError } = await supabase
    .from("shopping_lists")
    .select("id, user_id")
    .eq("id", trimmedListId)
    .maybeSingle();

  if (listError) {
    throw listError;
  }

  if (!listRecord) {
    return {
      listExists: false,
      hasAccess: false,
      isOwner: false,
      isMember: false,
      ownerId: null,
    };
  }

  const ownerId = String(listRecord.user_id ?? "");
  const normalizedUserId = String(userId ?? "");
  const isOwner = Boolean(normalizedUserId) && ownerId === normalizedUserId;

  if (isOwner) {
    return {
      listExists: true,
      hasAccess: true,
      isOwner: true,
      isMember: false,
      ownerId,
    };
  }

  if (!normalizedUserId) {
    return {
      listExists: true,
      hasAccess: false,
      isOwner: false,
      isMember: false,
      ownerId,
    };
  }

  const { data: membership, error: membershipError } = await supabase
    .from("shopping_list_members")
    .select("id")
    .eq("shopping_list_id", trimmedListId)
    .eq("user_id", normalizedUserId)
    .maybeSingle();

  if (membershipError) {
    throw membershipError;
  }

  const isMember = Boolean(membership);

  return {
    listExists: true,
    hasAccess: isMember,
    isOwner: false,
    isMember,
    ownerId,
  };
}

async function requireListAccess(listId, { allowMissing = false } = {}) {
  const userId = await getCurrentUserId();

  if (!userId) {
    throw createListAccessError(
      LIST_ACCESS_ERROR_CODES.UNAUTHENTICATED,
      "Du måste vara inloggad för att komma åt den här listan.",
    );
  }

  const context = await getListAccessContext(listId, userId);

  if (!context.listExists) {
    if (allowMissing) {
      return { userId, context };
    }

    throw createListAccessError(
      LIST_ACCESS_ERROR_CODES.NOT_FOUND,
      "Inköpslistan hittades inte.",
    );
  }

  if (!context.hasAccess) {
    throw createListAccessError(
      LIST_ACCESS_ERROR_CODES.FORBIDDEN,
      "Du har inte åtkomst till den här inköpslistan.",
    );
  }

  return { userId, context };
}

async function requireListOwner(listId) {
  const { userId, context } = await requireListAccess(listId);

  if (!context.isOwner) {
    throw createListShareError(
      LIST_SHARE_ERROR_CODES.NOT_OWNER,
      "Endast listägaren kan hantera medlemmar.",
    );
  }

  return {
    userId,
    context,
  };
}

function normalizeEmailAddress(value) {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeListMemberRow(row) {
  if (!row) {
    return null;
  }

  const normalizedProfile = row.profile
    ? {
      id: row.profile.id,
      email: String(row.profile.email ?? "").trim(),
      name: String(row.profile.name ?? "").trim(),
      created_at: row.profile.created_at ?? null,
    }
    : null;

  return {
    ...row,
    id: row.id,
    shopping_list_id: getFirstTruthyValue(row, ["shopping_list_id", "shoppingListId"]),
    user_id: getFirstTruthyValue(row, ["user_id", "userId"]),
    created_at: row.created_at ?? null,
    profile: normalizedProfile,
  };
}

async function findProfileByEmail(email) {
  const normalizedEmail = normalizeEmailAddress(email);

  if (!normalizedEmail) {
    return null;
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, name, created_at")
    .eq("email", normalizedEmail)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ?? null;
}

async function getMembershipRow(listId, userId) {
  const { data, error } = await supabase
    .from("shopping_list_members")
    .select("id, shopping_list_id, user_id")
    .eq("shopping_list_id", listId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ?? null;
}

async function getListIdForItem(itemId) {
  const { data, error } = await supabase
    .from("shopping_list_items")
    .select("shopping_list_id")
    .eq("id", itemId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  const listId = getItemListId(data);

  if (!listId) {
    throw createListAccessError(
      LIST_ACCESS_ERROR_CODES.NOT_FOUND,
      "Shopping list item not found.",
    );
  }

  return String(listId);
}

async function requireItemAccess(itemId) {
  const listId = await getListIdForItem(itemId);
  await requireListAccess(listId);
}

export async function userHasAccessToList(listId, userId) {
  const context = await getListAccessContext(listId, userId);
  return context.listExists && context.hasAccess;
}

export async function getListSharingContext(listId) {
  const { userId, context } = await requireListAccess(listId);

  return {
    listId: String(listId),
    currentUserId: userId,
    ownerId: context.ownerId,
    isOwner: context.isOwner,
    isMember: context.isMember,
  };
}

export async function getListMembers(listId) {
  const { context } = await requireListAccess(listId);

  const ownerId = String(context.ownerId ?? "").trim();
  let ownerProfile = null;

  if (ownerId) {
    const { data: ownerData, error: ownerError } = await supabase
      .from("profiles")
      .select("id, email, name, created_at")
      .eq("id", ownerId)
      .maybeSingle();

    if (ownerError) {
      throw ownerError;
    }

    ownerProfile = ownerData ?? null;
  }

  const { data, error } = await supabase
    .from("shopping_list_members")
    .select("id, shopping_list_id, user_id")
    .eq("shopping_list_id", String(listId))
    .order("user_id", { ascending: true });

  if (error) {
    throw error;
  }

  const rawMembers = data ?? [];
  const memberUserIds = Array.from(
    new Set(
      rawMembers
        .map((memberRow) => String(memberRow?.user_id ?? "").trim())
        .filter(Boolean),
    ),
  );

  let profileByUserId = new Map();

  if (memberUserIds.length > 0) {
    const { data: memberProfiles, error: memberProfilesError } = await supabase
      .from("profiles")
      .select("id, email, name, created_at")
      .in("id", memberUserIds);

    if (memberProfilesError) {
      throw memberProfilesError;
    }

    profileByUserId = new Map(
      (memberProfiles ?? []).map((profile) => [String(profile.id), profile]),
    );
  }

  const members = rawMembers
    .map((memberRow) => normalizeListMemberRow({
      ...memberRow,
      profile: profileByUserId.get(String(memberRow.user_id)) ?? null,
    }))
    .filter(Boolean);

  return {
    owner: ownerProfile,
    members,
  };
}

export async function inviteListMemberByEmail(listId, email) {
  const { context } = await requireListOwner(listId);

  const normalizedEmail = normalizeEmailAddress(email);
  const hasEmailShape = /^\S+@\S+\.\S+$/.test(normalizedEmail);

  if (!normalizedEmail || !hasEmailShape) {
    throw createListShareError(
      LIST_SHARE_ERROR_CODES.INVALID_EMAIL,
      "Ange en giltig e-postadress.",
    );
  }

  const profile = await findProfileByEmail(normalizedEmail);

  if (!profile?.id) {
    throw createListShareError(
      LIST_SHARE_ERROR_CODES.USER_NOT_FOUND,
      "Användaren hittades inte. Be personen skapa konto först.",
    );
  }

  const profileId = String(profile.id);

  if (profileId === String(context.ownerId ?? "")) {
    throw createListShareError(
      LIST_SHARE_ERROR_CODES.OWNER_CANNOT_BE_MEMBER,
      "Listägaren är redan medlem.",
    );
  }

  const existingMembership = await getMembershipRow(String(listId), profileId);
  if (existingMembership) {
    throw createListShareError(
      LIST_SHARE_ERROR_CODES.ALREADY_MEMBER,
      "Användaren är redan medlem i listan.",
    );
  }

  const payload = {
    shopping_list_id: String(listId),
    user_id: profileId,
  };

  const { data, error } = await supabase
    .from("shopping_list_members")
    .insert(payload)
    .select("id, shopping_list_id, user_id")
    .single();

  if (error) {
    throw error;
  }

  return normalizeListMemberRow(data);
}

export async function removeListMember(listId, memberUserId) {
  const { context } = await requireListOwner(listId);
  const normalizedUserId = String(memberUserId ?? "").trim();

  if (!normalizedUserId) {
    throw createListShareError(
      LIST_SHARE_ERROR_CODES.INVALID_USER,
      "Ogiltig användare.",
    );
  }

  if (normalizedUserId === String(context.ownerId ?? "")) {
    throw createListShareError(
      LIST_SHARE_ERROR_CODES.CANNOT_REMOVE_OWNER,
      "Listägaren kan inte tas bort från listan.",
    );
  }

  const { error } = await supabase
    .from("shopping_list_members")
    .delete()
    .eq("shopping_list_id", String(listId))
    .eq("user_id", normalizedUserId);

  if (error) {
    throw error;
  }

  return { removedUserId: normalizedUserId };
}

async function queryByPossibleColumns(queryFactory, candidateColumns, value) {
  let lastError = null;

  for (const column of candidateColumns) {
    const { data, error } = await queryFactory(column, value);

    if (!error) {
      return { data: data ?? [], matchedColumn: column };
    }

    lastError = error;
  }

  if (lastError) {
    throw lastError;
  }

  return { data: [], matchedColumn: null };
}

function normalizeListRecord(record) {
  if (!record) {
    return null;
  }

  return {
    ...record,
    title: getFirstTruthyValue(record, ["title", "name"]) ?? "Min Inköpslista",
    user_id: getFirstTruthyValue(record, ["user_id", "created_by"]),
    store_id: getFirstTruthyValue(record, ["store_id", "storeId"]),
    store_layout_id: getFirstTruthyValue(record, ["store_layout_id", "layout_id", "store_layout"]),
  };
}

function normalizeCategoryOrder(categoryOrderRows) {
  return (categoryOrderRows ?? []).map((row) => ({
    ...row,
    category_id: getFirstTruthyValue(row, ["category_id", "categoryId"]),
    order_index: Number(
      getFirstTruthyValue(row, ["display_order", "order_index", "sort_order", "position", "rank", "order"])
        ?? Number.MAX_SAFE_INTEGER,
    ),
  }));
}

function normalizeShoppingListStoreId(listRecord) {
  return getFirstTruthyValue(listRecord, ["store_id", "storeId"]);
}

async function hydrateShoppingListItems(itemRows) {
  const items = itemRows ?? [];
  const productIds = Array.from(new Set(
    items
      .map((item) => item.product_id)
      .filter(Boolean),
  ));

  const missingProductIds = productIds.filter((id) => !productCacheById.has(id));

  if (missingProductIds.length > 0) {
    const { data: products, error: productsError } = await supabase
      .from("products")
      .select("id, name, category_id")
      .in("id", missingProductIds);

    if (productsError) {
      throw productsError;
    }

    for (const product of products ?? []) {
      productCacheById.set(product.id, product);
    }
  }

  const categoryIds = Array.from(new Set(
    productIds
      .map((productId) => productCacheById.get(productId)?.category_id)
      .filter(Boolean),
  ));

  const missingCategoryIds = categoryIds.filter((id) => !categoryCacheById.has(id));

  if (missingCategoryIds.length > 0) {
    const { data: categories, error: categoriesError } = await supabase
      .from("categories")
      .select("id, name")
      .in("id", missingCategoryIds);

    if (categoriesError) {
      throw categoriesError;
    }

    for (const category of categories ?? []) {
      categoryCacheById.set(category.id, category);
    }
  }

  return items.map((item) => {
    const product = item.product_id ? productCacheById.get(item.product_id) ?? null : null;
    const categoryId = getFirstTruthyValue(item, ["category_id", "categoryId", "product_category_id"])
      ?? product?.category_id
      ?? null;

    const category = categoryId ? categoryCacheById.get(categoryId) ?? null : null;
    const categoryName = normalizeCategoryName(category?.name ?? item.category_name ?? product?.category_name);

    return {
      ...item,
      shopping_list_id: getItemListId(item),
      product,
      category,
      display_name: item.custom_name || product?.name || "Okänd vara",
      category_name: categoryName,
      is_checked: Boolean(item.is_checked),
      notes: String(item.notes ?? ""),
      is_custom: Boolean(item.custom_name && !item.product_id),
    };
  });
}

async function getShoppingListStoreId(listId) {
  const { data, error } = await supabase
    .from("shopping_lists")
    .select("*")
    .eq("id", listId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  return normalizeShoppingListStoreId(data);
}

async function shouldSkipPurchaseInsert({ userId, storeId, productId, purchasedAt }) {
  // Keep at most one purchase entry per product/store/day for a user.
  const dayStart = new Date(
    purchasedAt.getFullYear(),
    purchasedAt.getMonth(),
    purchasedAt.getDate(),
    0,
    0,
    0,
    0,
  );
  const nextDayStart = new Date(
    purchasedAt.getFullYear(),
    purchasedAt.getMonth(),
    purchasedAt.getDate() + 1,
    0,
    0,
    0,
    0,
  );

  const { data, error } = await supabase
    .from("purchase_history")
    .select("id, purchased_at")
    .eq("user_id", userId)
    .eq("store_id", storeId)
    .eq("product_id", productId)
    .gte("purchased_at", dayStart.toISOString())
    .lt("purchased_at", nextDayStart.toISOString())
    .order("purchased_at", { ascending: false })
    .limit(1);

  if (error) {
    throw error;
  }

  return Boolean(data?.length);
}

async function insertPurchaseHistoryEntry({ userId, storeId, productId, purchasedAt }) {
  const shouldSkip = await shouldSkipPurchaseInsert({
    userId,
    storeId,
    productId,
    purchasedAt,
  });

  if (shouldSkip) {
    return;
  }

  const { error } = await supabase
    .from("purchase_history")
    .insert({
      user_id: userId,
      store_id: storeId,
      product_id: productId,
      quantity: 1,
      purchased_at: purchasedAt.toISOString(),
    });

  if (error) {
    throw error;
  }
}

export async function getShoppingListItems(listId, { skipAccessCheck = false } = {}) {
  if (!skipAccessCheck) {
    await requireListAccess(listId);
  }

  const { data: itemRows } = await queryByPossibleColumns(
    (column, value) => supabase
      .from("shopping_list_items")
      .select("*")
      .eq(column, value),
    LIST_REFERENCE_COLUMNS,
    listId,
  );

  return hydrateShoppingListItems(itemRows ?? []);
}

export async function getShoppingListItemById(itemId) {
  await requireItemAccess(itemId);

  const { data, error } = await supabase
    .from("shopping_list_items")
    .select("*")
    .eq("id", itemId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  const [item] = await hydrateShoppingListItems([data]);
  return item ?? null;
}

export async function getShoppingList(listId) {
  const { context } = await requireListAccess(listId, { allowMissing: true });

  if (!context.listExists) {
    return null;
  }

  const { data: listData, error: listError } = await supabase
    .from("shopping_lists")
    .select("*")
    .eq("id", listId)
    .maybeSingle();

  if (listError) {
    throw listError;
  }

  if (!listData) {
    return null;
  }

  const list = normalizeListRecord(listData);

  const [storeResult, layoutResult, categoryOrderResult, items] = await Promise.all([
    list.store_id
      ? supabase
        .from("stores")
        .select("*")
        .eq("id", list.store_id)
        .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    list.store_layout_id
      ? supabase
        .from("store_layouts")
        .select("*")
        .eq("id", list.store_layout_id)
        .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    list.store_layout_id
      ? supabase
        .from("store_category_order")
        .select("layout_id, category_id, display_order")
        .eq("layout_id", list.store_layout_id)
        .order("display_order", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    getShoppingListItems(listId, { skipAccessCheck: true }),
  ]);

  if (storeResult.error) {
    throw storeResult.error;
  }

  if (layoutResult.error) {
    throw layoutResult.error;
  }

  if (categoryOrderResult.error) {
    throw categoryOrderResult.error;
  }

  const store = storeResult.data ?? null;
  const layout = layoutResult.data ?? null;
  const categoryOrder = normalizeCategoryOrder(categoryOrderResult.data ?? []);

  return {
    ...list,
    store,
    layout,
    items,
    category_order: categoryOrder,
  };
}

export async function searchProducts(searchQuery) {
  const query = searchQuery.trim();

  if (!query) {
    return [];
  }

  const { data, error } = await supabase
    .from("products")
    .select("id, name, category_id")
    .ilike("name", `%${query}%`)
    .limit(10);

  if (error) {
    throw error;
  }

  return data ?? [];
}

async function insertShoppingListItem(payloadVariants) {
  let lastError = null;

  for (const payload of payloadVariants) {
    const { data, error } = await supabase
      .from("shopping_list_items")
      .insert(payload)
      .select("*")
      .single();

    if (!error) {
      return data;
    }

    lastError = error;
  }

  throw lastError;
}

export async function addShoppingListItem(listId, { productId = null, customName = null } = {}) {
  const trimmedListId = String(listId).trim();
  const cleanedCustomName = customName === null ? null : String(customName).trim();

  if (!trimmedListId) {
    throw new Error("List id is required.");
  }

  if (!productId && !cleanedCustomName) {
    throw new Error("Either productId or customName is required.");
  }

  await requireListAccess(trimmedListId);

  const basePayload = {
    product_id: productId ?? null,
    custom_name: productId ? null : cleanedCustomName,
    is_checked: false,
  };

  const payloadVariants = [{ shopping_list_id: trimmedListId, ...basePayload }];

  return insertShoppingListItem(payloadVariants);
}

export async function addItemToList(listId, productId) {
  return addShoppingListItem(listId, { productId });
}

export async function addCustomItem(listId, name) {
  const cleanedName = name.trim();

  if (!cleanedName) {
    throw new Error("Item name is required.");
  }

  return addShoppingListItem(listId, { customName: cleanedName });
}

export async function toggleItemChecked(itemId, checked) {
  await requireItemAccess(itemId);

  const nextCheckedState = Boolean(checked);
  const { data: currentItem, error: currentItemError } = await supabase
    .from("shopping_list_items")
    .select("id, shopping_list_id, product_id, is_checked")
    .eq("id", itemId)
    .maybeSingle();

  if (currentItemError) {
    throw currentItemError;
  }

  if (!currentItem) {
    throw createListAccessError(
      LIST_ACCESS_ERROR_CODES.NOT_FOUND,
      "Shopping list item not found.",
    );
  }

  const wasChecked = Boolean(currentItem.is_checked);
  const currentUserId = await getCurrentUserId();
  const purchaseTimestamp = new Date();

  const { error } = await supabase
    .from("shopping_list_items")
    .update({
      is_checked: nextCheckedState,
      checked_at: nextCheckedState ? purchaseTimestamp.toISOString() : null,
    })
    .eq("id", itemId);

  if (error) {
    console.error("toggleItemChecked failed", {
      itemId,
      checked: nextCheckedState,
      error,
    });
    throw error;
  }

  const shouldInsertPurchase = Boolean(
    nextCheckedState
      && !wasChecked
      && currentItem.product_id
      && currentUserId,
  );

  if (!shouldInsertPurchase) {
    return;
  }

  const shoppingListId = String(getItemListId(currentItem) ?? "");
  if (!shoppingListId) {
    return;
  }

  const storeId = await getShoppingListStoreId(shoppingListId);

  if (!storeId) {
    return;
  }

  await insertPurchaseHistoryEntry({
    userId: currentUserId,
    storeId,
    productId: currentItem.product_id,
    purchasedAt: purchaseTimestamp,
  });
}

export async function deleteListItem(itemId) {
  await requireItemAccess(itemId);

  const { error } = await supabase
    .from("shopping_list_items")
    .delete()
    .eq("id", itemId);

  if (error) {
    throw error;
  }
}

export async function updateItemNotes(itemId, notes) {
  await requireItemAccess(itemId);

  const noteText = String(notes ?? "");

  const payloads = [{ notes: noteText }, { note: noteText }];
  let lastError = null;

  for (const payload of payloads) {
    const { error } = await supabase
      .from("shopping_list_items")
      .update(payload)
      .eq("id", itemId);

    if (!error) {
      return;
    }

    lastError = error;
  }

  throw lastError;
}

export async function updateShoppingListTitle(listId, title) {
  await requireListAccess(listId);

  const trimmedTitle = String(title ?? "").trim();
  const payloads = [{ title: trimmedTitle }, { name: trimmedTitle }];
  let lastError = null;

  for (const payload of payloads) {
    const { error } = await supabase
      .from("shopping_lists")
      .update(payload)
      .eq("id", listId);

    if (!error) {
      return;
    }

    lastError = error;
  }

  throw lastError;
}

export async function getSuggestedProducts(list, dismissedProductIds = []) {
  const sourceListId = String(list?.id ?? "").trim();

  if (sourceListId) {
    await requireListAccess(sourceListId);
  }

  const dismissedIds = new Set(dismissedProductIds.map((id) => String(id)));
  const userId = await getCurrentUserId();

  if (!userId) {
    return [];
  }

  const storeId = normalizeShoppingListStoreId(list);
  if (!storeId) {
    return [];
  }

  const existingProductIdsOnList = new Set(
    (list?.items ?? [])
      .map((item) => item?.product_id)
      .filter(Boolean)
      .map((id) => String(id)),
  );

  const { data: purchaseRows, error } = await supabase
    .from("purchase_history")
    .select("product_id")
    .eq("user_id", userId)
    .eq("store_id", storeId)
    .not("product_id", "is", null)
    .order("purchased_at", { ascending: false })
    .limit(2500);

  if (error) {
    throw error;
  }

  const usageByProductId = new Map();

  for (const purchaseRow of purchaseRows ?? []) {
    const productId = purchaseRow.product_id;
    if (!productId) {
      continue;
    }

    const key = String(productId);
    if (dismissedIds.has(key) || existingProductIdsOnList.has(key)) {
      continue;
    }

    usageByProductId.set(key, (usageByProductId.get(key) ?? 0) + 1);
  }

  const rankedProductIds = Array.from(usageByProductId.entries())
    .filter(([, usageCount]) => usageCount > 1)
    .sort((a, b) => b[1] - a[1])
    .map(([productId]) => productId)
    .slice(0, 30);

  if (rankedProductIds.length === 0) {
    return [];
  }

  const { data: products, error: productsError } = await supabase
    .from("products")
    .select("id, name, category_id")
    .in("id", rankedProductIds);

  if (productsError) {
    throw productsError;
  }

  const productById = new Map((products ?? []).map((product) => [String(product.id), product]));

  return rankedProductIds
    .map((productId) => {
      const product = productById.get(String(productId));

      if (!product) {
        return null;
      }

      return {
        ...product,
        usage_count: usageByProductId.get(String(product.id)) ?? 0,
      };
    })
    .filter(Boolean);
}

export async function getStores() {
  const { data, error } = await supabase
    .from("stores")
    .select("id, name, city")
    .order("name", { ascending: true })
    .limit(200);

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function searchStores({ storeName, city }) {
  const trimmedStoreName = String(storeName ?? "").trim();
  const trimmedCity = String(city ?? "").trim();

  if (!trimmedStoreName && !trimmedCity) {
    return [];
  }

  let query = supabase.from("stores").select("id, name, city");

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
  const trimmedStoreName = String(storeName ?? "").trim();
  const trimmedCity = String(city ?? "").trim();

  if (!trimmedStoreName || !trimmedCity) {
    throw new Error("Both store name and city are required.");
  }

  const { data: existingStores, error: existingStoreError } = await supabase
    .from("stores")
    .select("id, name, city")
    .ilike("name", trimmedStoreName)
    .ilike("city", trimmedCity)
    .limit(1);

  if (existingStoreError) {
    throw existingStoreError;
  }

  if (existingStores?.length) {
    return existingStores[0];
  }

  const { data: insertedStore, error: insertError } = await supabase
    .from("stores")
    .insert({
      name: trimmedStoreName,
      city: trimmedCity,
    })
    .select("id, name, city")
    .single();

  if (insertError) {
    throw insertError;
  }

  return insertedStore;
}

export async function getStoreLayouts(storeId) {
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

export async function updateShoppingListStoreAndLayout(listId, { storeId, layoutId = null } = {}) {
  const trimmedListId = String(listId ?? "").trim();

  if (!trimmedListId || !storeId) {
    throw new Error("List id and store id are required.");
  }

  await requireListAccess(trimmedListId);

  const payloads = [
    { store_id: storeId, store_layout_id: layoutId },
    { store_id: storeId, layout_id: layoutId },
    { store_id: storeId },
  ];

  let lastError = null;

  for (const payload of payloads) {
    const { error } = await supabase
      .from("shopping_lists")
      .update(payload)
      .eq("id", trimmedListId);

    if (!error) {
      return;
    }

    lastError = error;
  }

  throw lastError;
}

export function subscribeToShoppingListItems(listId, {
  onInsert,
  onUpdate,
  onDelete,
  onStatus,
  onError,
} = {}) {
  if (!supabase) {
    onStatus?.("CLOSED");
    return () => {};
  }

  const normalizedListId = String(listId ?? "").trim();

  if (!normalizedListId) {
    onStatus?.("CLOSED");
    return () => {};
  }

  const channel = supabase
    .channel(`shopping-list-items-${normalizedListId}-${Date.now()}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "shopping_list_items",
      },
      (payload) => {
        const payloadListId = getRealtimePayloadListId(payload);

        if (payload?.eventType === "DELETE" && !payloadListId) {
          onDelete?.(payload);
          return;
        }

        if (payloadListId !== normalizedListId) {
          return;
        }

        if (payload?.eventType === "INSERT") {
          onInsert?.(payload);
          return;
        }

        if (payload?.eventType === "UPDATE") {
          onUpdate?.(payload);
          return;
        }

        if (payload?.eventType === "DELETE") {
          onDelete?.(payload);
        }
      },
    )
    .subscribe((status, error) => {
      onStatus?.(status);

      if (error) {
        onError?.(error);
      }
    });

  return () => {
    supabase.removeChannel(channel);
  };
}

export function subscribeToShoppingListMeta(listId, {
  onUpdate,
  onStatus,
  onError,
} = {}) {
  if (!supabase) {
    onStatus?.("CLOSED");
    return () => {};
  }

  const normalizedListId = String(listId ?? "").trim();

  if (!normalizedListId) {
    onStatus?.("CLOSED");
    return () => {};
  }

  const channel = supabase
    .channel(`shopping-list-meta-${normalizedListId}-${Date.now()}`)
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "shopping_lists",
      },
      (payload) => {
        const payloadListId = String(payload?.new?.id ?? payload?.old?.id ?? "").trim();

        if (payloadListId !== normalizedListId) {
          return;
        }

        onUpdate?.(payload);
      },
    )
    .subscribe((status, error) => {
      onStatus?.(status);

      if (error) {
        onError?.(error);
      }
    });

  return () => {
    supabase.removeChannel(channel);
  };
}
