import { supabase } from "../../api-service.js";

const LIST_REFERENCE_COLUMNS = ["shopping_list_id", "list_id"];

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
    title: getFirstTruthyValue(record, ["title", "name"]) ?? "Min Inkoplista",
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
      getFirstTruthyValue(row, ["order_index", "sort_order", "position", "rank", "order"])
        ?? Number.MAX_SAFE_INTEGER,
    ),
  }));
}

export async function getShoppingListItems(listId) {
  const { data: itemRows } = await queryByPossibleColumns(
    (column, value) => supabase
      .from("shopping_list_items")
      .select("*")
      .eq(column, value),
    LIST_REFERENCE_COLUMNS,
    listId,
  );

  const items = itemRows ?? [];
  const productIds = Array.from(new Set(
    items
      .map((item) => item.product_id)
      .filter(Boolean),
  ));

  const productsById = new Map();
  const categoriesById = new Map();

  if (productIds.length > 0) {
    const { data: products, error: productsError } = await supabase
      .from("products")
      .select("*")
      .in("id", productIds);

    if (productsError) {
      throw productsError;
    }

    for (const product of products ?? []) {
      productsById.set(product.id, product);
    }

    const categoryIds = Array.from(new Set(
      (products ?? [])
        .map((product) => product.category_id)
        .filter(Boolean),
    ));

    if (categoryIds.length > 0) {
      const { data: categories, error: categoriesError } = await supabase
        .from("categories")
        .select("*")
        .in("id", categoryIds);

      if (categoriesError) {
        throw categoriesError;
      }

      for (const category of categories ?? []) {
        categoriesById.set(category.id, category);
      }
    }
  }

  return items.map((item) => {
    const product = item.product_id ? productsById.get(item.product_id) ?? null : null;
    const categoryId = getFirstTruthyValue(item, ["category_id", "categoryId", "product_category_id"])
      ?? product?.category_id
      ?? null;

    const category = categoryId ? categoriesById.get(categoryId) ?? null : null;

    return {
      ...item,
      list_id: getItemListId(item),
      product,
      category,
      display_name: item.custom_name || product?.name || "Okand vara",
      category_name: category?.name || "Diverse",
      is_checked: Boolean(item.is_checked),
      notes: String(item.notes ?? ""),
      is_custom: Boolean(item.custom_name && !item.product_id),
    };
  });
}

export async function getShoppingList(listId) {
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

  let store = null;
  if (list.store_id) {
    const { data: storeData, error: storeError } = await supabase
      .from("stores")
      .select("*")
      .eq("id", list.store_id)
      .maybeSingle();

    if (storeError) {
      throw storeError;
    }

    store = storeData ?? null;
  }

  let layout = null;
  if (list.store_layout_id) {
    const { data: layoutData, error: layoutError } = await supabase
      .from("store_layouts")
      .select("*")
      .eq("id", list.store_layout_id)
      .maybeSingle();

    if (layoutError) {
      throw layoutError;
    }

    layout = layoutData ?? null;
  }

  let categoryOrder = [];
  if (list.store_id) {
    const { data: orderRows, error: orderError } = await supabase
      .from("store_category_order")
      .select("*")
      .eq("store_id", list.store_id);

    if (!orderError) {
      categoryOrder = normalizeCategoryOrder(orderRows);
    }
  }

  const items = await getShoppingListItems(listId);

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

export async function addItemToList(listId, productId) {
  const trimmedListId = String(listId).trim();

  const payloadVariants = [
    { shopping_list_id: trimmedListId, product_id: productId, is_checked: false },
    { list_id: trimmedListId, product_id: productId, is_checked: false },
  ];

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

export async function addCustomItem(listId, name) {
  const cleanedName = name.trim();

  if (!cleanedName) {
    throw new Error("Item name is required.");
  }

  const payloadVariants = [
    { shopping_list_id: String(listId).trim(), custom_name: cleanedName, is_checked: false },
    { list_id: String(listId).trim(), custom_name: cleanedName, is_checked: false },
  ];

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

export async function toggleItemChecked(itemId, checked) {
  const { error } = await supabase
    .from("shopping_list_items")
    .update({ is_checked: checked })
    .eq("id", itemId);

  if (error) {
    throw error;
  }
}

export async function deleteListItem(itemId) {
  const { error } = await supabase
    .from("shopping_list_items")
    .delete()
    .eq("id", itemId);

  if (error) {
    throw error;
  }
}

export async function updateItemNotes(itemId, notes) {
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
  const dismissedIds = new Set(dismissedProductIds.map((id) => String(id)));
  const listId = list?.id;
  const userId = list?.user_id;

  const { data: checkedItems, error } = await supabase
    .from("shopping_list_items")
    .select("*")
    .eq("is_checked", true)
    .limit(1500);

  if (error) {
    throw error;
  }

  let allowedListIds = [];
  if (userId) {
    const userIdColumns = ["user_id", "created_by"];

    const { data: userLists } = await queryByPossibleColumns(
      (column, value) => supabase
        .from("shopping_lists")
        .select("id")
        .eq(column, value),
      userIdColumns,
      userId,
    );

    allowedListIds = (userLists ?? []).map((userList) => String(userList.id));
  }

  const usageByProductId = new Map();

  for (const item of checkedItems ?? []) {
    const productId = item.product_id;

    if (!productId) {
      continue;
    }

    if (userId && allowedListIds.length > 0) {
      const itemListId = String(getItemListId(item) ?? "");
      if (!allowedListIds.includes(itemListId)) {
        continue;
      }
    }

    if (!userId && listId && String(getItemListId(item) ?? "") !== String(listId)) {
      continue;
    }

    const key = String(productId);
    usageByProductId.set(key, (usageByProductId.get(key) ?? 0) + 1);
  }

  const rankedProductIds = Array.from(usageByProductId.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([productId]) => productId)
    .filter((productId) => !dismissedIds.has(productId))
    .slice(0, 10);

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
