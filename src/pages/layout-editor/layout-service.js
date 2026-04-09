import { supabase } from "../../api-service.js";

const SECTION_CATEGORIES_TABLE = "categories";
const STORES_TABLE = "stores";
const STORE_LAYOUTS_TABLE = "store_layouts";
const STORE_CATEGORY_ORDER_TABLE = "store_category_order";

function requireSupabaseConfig() {
	if (!supabase) {
		throw new Error("Supabase är inte konfigurerat. Ange VITE_SUPABASE_URL och VITE_SUPABASE_ANON_KEY.");
	}
}

function normalizeSlug(value) {
	return String(value || "")
		.toLowerCase()
		.trim()
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/[_\s]+/g, "-")
		.replace(/-+/g, "-")
		.replace(/^-|-$/g, "");
}

function uniqueSlugs(values) {
	const seen = new Set();
	const normalizedSlugs = [];

	for (const rawValue of values) {
		const slug = normalizeSlug(rawValue);

		if (!slug) continue;
		if (seen.has(slug)) continue;

		seen.add(slug);
		normalizedSlugs.push(slug);
	}

	return normalizedSlugs;
}

function normalizeText(value) {
	return String(value || "").trim();
}

function normalizeCaseInsensitiveKey(value) {
	return normalizeText(value).toLowerCase();
}

function escapeLikePattern(value) {
	return String(value || "").replace(/([%_\\])/g, "\\$1");
}

async function getAuthenticatedUserId() {
	requireSupabaseConfig();

	const {
		data: { user },
		error,
	} = await supabase.auth.getUser();

	if (error) throw error;
	if (!user?.id) throw new Error("Ingen inloggad användare hittades.");

	return user.id;
}

async function fetchCategoryIdBySlug() {
	const { data, error } = await supabase.from(SECTION_CATEGORIES_TABLE).select("id, name").limit(1000);

	if (error) throw error;

	const categoryIdBySlug = new Map();
	for (const row of data || []) {
		const slug = normalizeSlug(row?.name);
		if (!slug) continue;
		categoryIdBySlug.set(slug, row.id);
	}

	return categoryIdBySlug;
}

async function getOrCreateStore({ storeName, cityName, userId }) {
	const normalizedStoreName = normalizeText(storeName);
	const normalizedCityName = normalizeText(cityName);
	const escapedStoreName = escapeLikePattern(normalizedStoreName);
	const escapedCityName = escapeLikePattern(normalizedCityName);

	const { data: matchingStores, error: storeLookupError } = await supabase
		.from(STORES_TABLE)
		.select("id, name, city, created_at")
		.eq("created_by", userId)
		.ilike("name", escapedStoreName)
		.ilike("city", escapedCityName)
		.order("created_at", { ascending: true })
		.limit(10);

	if (storeLookupError) throw storeLookupError;

	const targetStoreKey = normalizeCaseInsensitiveKey(normalizedStoreName);
	const targetCityKey = normalizeCaseInsensitiveKey(normalizedCityName);

	const existingStore = (matchingStores || []).find((store) => {
		const storeKey = normalizeCaseInsensitiveKey(store?.name);
		const cityKey = normalizeCaseInsensitiveKey(store?.city);
		return storeKey === targetStoreKey && cityKey === targetCityKey;
	});

	if (existingStore?.id) return existingStore.id;

	const { data: createdStore, error: createStoreError } = await supabase
		.from(STORES_TABLE)
		.insert({
			name: normalizedStoreName,
			city: normalizedCityName,
			created_by: userId,
		})
		.select("id")
		.single();

	if (createStoreError) throw createStoreError;

	return createdStore.id;
}

async function resolveExistingLayoutId({ layoutId, storeId, userId }) {
	if (layoutId) {
		const { data, error } = await supabase
			.from(STORE_LAYOUTS_TABLE)
			.select("id")
			.eq("id", layoutId)
			.eq("created_by", userId)
			.maybeSingle();

		if (error) throw error;
		if (!data?.id) {
			throw new Error("Du kan bara redigera layouter du själv har skapat.");
		}

		return data.id;
	}

	const { data, error } = await supabase
		.from(STORE_LAYOUTS_TABLE)
		.select("id")
		.eq("store_id", storeId)
		.eq("created_by", userId)
		.maybeSingle();

	if (error) throw error;
	return data?.id || "";
}

async function upsertLayoutRow({ existingLayoutId, storeId, userId, layoutName }) {
	const payload = {
		store_id: storeId,
		created_by: userId,
		name: normalizeText(layoutName),
	};

	if (existingLayoutId) {
		const { data, error } = await supabase
			.from(STORE_LAYOUTS_TABLE)
			.update(payload)
			.eq("id", existingLayoutId)
			.eq("created_by", userId)
			.select("id")
			.single();

		if (error) throw error;
		return { layoutId: data.id, mode: "updated" };
	}

	const { data, error } = await supabase.from(STORE_LAYOUTS_TABLE).insert(payload).select("id").single();

	if (error) throw error;
	return { layoutId: data.id, mode: "created" };
}

async function replaceLayoutSectionOrder({ layoutId, sectionSlugs }) {
	const categoryIdBySlug = await fetchCategoryIdBySlug();

	const rows = sectionSlugs.map((slug, index) => {
		const categoryId = categoryIdBySlug.get(normalizeSlug(slug));
		if (!categoryId) {
			throw new Error(`Saknar kategori i databasen för sektion: ${slug}`);
		}

		return {
			layout_id: layoutId,
			category_id: categoryId,
			display_order: index + 1,
		};
	});

	const { error: deleteError } = await supabase.from(STORE_CATEGORY_ORDER_TABLE).delete().eq("layout_id", layoutId);
	if (deleteError) throw deleteError;

	if (rows.length === 0) return;

	const { error: insertError } = await supabase.from(STORE_CATEGORY_ORDER_TABLE).insert(rows);
	if (insertError) throw insertError;
}

function wrapLayoutSaveError(error) {
	const message = String(error?.message || "");
	const code = String(error?.code || "");
	const lowercaseMessage = message.toLowerCase();

	if (code === "42501" || lowercaseMessage.includes("permission") || lowercaseMessage.includes("policy")) {
		return new Error("Databasen nekar åtkomst. Kontrollera RLS policies för stores, store_layouts och store_category_order.");
	}

	if (lowercaseMessage.includes("foreign key") || lowercaseMessage.includes("violates foreign key")) {
		return new Error("Kunde inte spara layouten på grund av relationsfel i databasen.");
	}

	if (error instanceof Error) {
		return error;
	}

	return new Error(message || "Ett okänt fel uppstod vid sparning av butikslayout.");
}

async function fetchOrderedSectionSlugsForLayout(layoutId) {
	const { data: orderRows, error: orderError } = await supabase
		.from(STORE_CATEGORY_ORDER_TABLE)
		.select("category_id, display_order")
		.eq("layout_id", layoutId)
		.order("display_order", { ascending: true });

	if (orderError) throw orderError;

	const categoryIds = (orderRows || []).map((row) => row.category_id).filter(Boolean);
	if (categoryIds.length === 0) return [];

	const { data: categoryRows, error: categoryError } = await supabase
		.from(SECTION_CATEGORIES_TABLE)
		.select("id, name")
		.in("id", categoryIds);

	if (categoryError) throw categoryError;

	const categoryNameById = new Map((categoryRows || []).map((row) => [row.id, row.name]));

	return (orderRows || [])
		.map((row) => normalizeSlug(categoryNameById.get(row.category_id)))
		.filter(Boolean);
}

export async function findMyLayoutByStoreAndCity({ storeName, cityName }) {
	requireSupabaseConfig();

	const normalizedStoreName = normalizeText(storeName);
	const normalizedCityName = normalizeText(cityName);
	if (!normalizedStoreName || !normalizedCityName) return null;

	const userId = await getAuthenticatedUserId();
	const escapedStoreName = escapeLikePattern(normalizedStoreName);
	const escapedCityName = escapeLikePattern(normalizedCityName);
	const targetStoreKey = normalizeCaseInsensitiveKey(normalizedStoreName);
	const targetCityKey = normalizeCaseInsensitiveKey(normalizedCityName);

	const { data: matchingStores, error: storeError } = await supabase
		.from(STORES_TABLE)
		.select("id, name, city, created_at")
		.eq("created_by", userId)
		.ilike("name", escapedStoreName)
		.ilike("city", escapedCityName)
		.order("created_at", { ascending: true })
		.limit(20);

	if (storeError) throw storeError;

	const exactStores = (matchingStores || []).filter((store) => {
		const storeKey = normalizeCaseInsensitiveKey(store?.name);
		const cityKey = normalizeCaseInsensitiveKey(store?.city);
		return storeKey === targetStoreKey && cityKey === targetCityKey;
	});

	if (exactStores.length === 0) return null;

	const storeIds = exactStores.map((store) => store.id);
	const { data: layouts, error: layoutError } = await supabase
		.from(STORE_LAYOUTS_TABLE)
		.select("id, store_id, name, created_at")
		.eq("created_by", userId)
		.in("store_id", storeIds)
		.order("created_at", { ascending: true })
		.limit(20);

	if (layoutError) throw layoutError;
	if (!layouts || layouts.length === 0) return null;

	const selectedLayout = layouts[0];
	const sectionSlugs = await fetchOrderedSectionSlugsForLayout(selectedLayout.id);

	return {
		layoutId: selectedLayout.id,
		storeId: selectedLayout.store_id,
		layoutName: normalizeText(selectedLayout.name),
		storeName: normalizedStoreName,
		cityName: normalizedCityName,
		sectionSlugs,
	};
}

export async function saveStoreLayout({
	layoutId,
	storeName,
	cityName,
	sectionSlugs,
}) {
	requireSupabaseConfig();

	const normalizedStoreName = normalizeText(storeName);
	const normalizedCityName = normalizeText(cityName);
	const normalizedSectionSlugs = uniqueSlugs(sectionSlugs || []);

	if (!normalizedStoreName) throw new Error("Butiksnamn saknas.");
	if (!normalizedCityName) throw new Error("Stad saknas.");
	if (normalizedSectionSlugs.length === 0) throw new Error("Layouten måste innehålla minst en sektion.");

	try {
		const userId = await getAuthenticatedUserId();
		const storeId = await getOrCreateStore({
			storeName: normalizedStoreName,
			cityName: normalizedCityName,
			userId,
		});

		const existingLayoutId = await resolveExistingLayoutId({
			layoutId: normalizeText(layoutId),
			storeId,
			userId,
		});

		const persistedLayout = await upsertLayoutRow({
			existingLayoutId,
			storeId,
			userId,
			layoutName: normalizedStoreName,
		});

		await replaceLayoutSectionOrder({
			layoutId: persistedLayout.layoutId,
			sectionSlugs: normalizedSectionSlugs,
		});

		return {
			layoutId: persistedLayout.layoutId,
			storeId,
			mode: persistedLayout.mode,
		};
	} catch (error) {
		throw wrapLayoutSaveError(error);
	}
}

export async function fetchSectionCategories() {
	requireSupabaseConfig();

	const { data, error } = await supabase
		.from(SECTION_CATEGORIES_TABLE)
		.select("name")
		.order("name", { ascending: true })
		.limit(500);

	if (error) {
		const message = String(error?.message || "");
		const code = String(error?.code || "");
		const isPermissionIssue =
			code === "42501" ||
			message.toLowerCase().includes("permission") ||
			message.toLowerCase().includes("policy");

		if (isPermissionIssue) {
			throw new Error("Kunde inte läsa categories. Kontrollera RLS policy för SELECT på categories.");
		}

		if (error instanceof Error) {
			throw error;
		}

		const wrappedError = new Error(message || "Ett okänt fel uppstod vid hämtning av categories.");
		if (code) {
			wrappedError.code = code;
		}
		throw wrappedError;
	}

	const slugs = Array.isArray(data) ? data.map((row) => row?.name) : [];
	return uniqueSlugs(slugs);
}