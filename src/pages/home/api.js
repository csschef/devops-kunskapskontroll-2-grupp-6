import { getCurrentSession } from "../../auth-service.js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey);
const PAGE_SIZE = 1000;
const MAX_PAGES = 200;
const QUERY_LATEST_LISTS_FOR_USER = (userId) => `shopping_lists?user_id=eq.${encodeValue(userId)}&select=id,title,is_completed,updated_at,created_at,stores(name,city),store_layouts(stores(name,city))&order=updated_at.desc.nullslast,created_at.desc&limit=3`;
const QUERY_LAYOUTS = `store_layouts?select=id,name,stores(name,city)&order=id.asc`;
const QUERY_LAYOUT_USAGE = `shopping_lists?select=id,layout_id,user_id&layout_id=not.is.null&user_id=not.is.null&order=id.asc`;
const QUERY_TOP_PRODUCTS = `purchase_history?select=id,product_id,quantity,products!inner(name)&product_id=not.is.null&order=id.asc`;
const QUERY_USER_STATS_LISTS = (userId) => `shopping_lists?user_id=eq.${encodeValue(userId)}&select=id,is_completed,stores(name,city),store_layouts(stores(name,city))`;
const QUERY_USER_STATS_MEMBERS = (userId) => `shopping_list_members?user_id=eq.${encodeValue(userId)}&select=id,shopping_list_id`;

function requireSupabaseRestConfig() {
    if (!hasSupabaseConfig) {
        throw new Error("Supabase REST är inte konfigurerat. Ange VITE_SUPABASE_URL och VITE_SUPABASE_ANON_KEY.");
    }
}

function encodeValue(value) {
    return encodeURIComponent(String(value));
}

async function restGet(path, accessToken) {
    requireSupabaseRestConfig();

    const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
        method: "GET",
        headers: {
            apikey: supabaseAnonKey,
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/json",
        },
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`REST request failed (${response.status}): ${errorText}`);
    }

    return response.json();
}

async function restGetPublic(path) {
    requireSupabaseRestConfig();

    const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
        method: "GET",
        headers: {
            apikey: supabaseAnonKey,
            Authorization: `Bearer ${supabaseAnonKey}`,
            Accept: "application/json",
        },
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Public REST request failed (${response.status}): ${errorText}`);
    }

    return response.json();
}

function withPagination(path, limit, offset) {
    return `${path}&limit=${limit}&offset=${offset}`;
}

async function fetchAllRows(requestFn, basePath, pageSize = PAGE_SIZE, maxPages = MAX_PAGES) {
    const rows = [];

    for (let pageIndex = 0; pageIndex < maxPages; pageIndex += 1) {
        const offset = pageIndex * pageSize;
        const page = await requestFn(withPagination(basePath, pageSize, offset));

        if (!Array.isArray(page) || page.length === 0) {
            break;
        }

        rows.push(...page);

        if (page.length < pageSize) {
            break;
        }
    }

    if (rows.length >= pageSize * maxPages) {
        console.warn("Home API pagination reached maxPages cap; consider server-side aggregates for better scalability.");
    }

    return rows;
}

async function fetchAllRowsPublicThenAuth(basePath, accessToken) {
    let publicRows = [];

    try {
        publicRows = await fetchAllRows((path) => restGetPublic(path), basePath);
    } catch (error) {
        console.warn("Public paginated fetch failed:", error);
    }

    if (publicRows.length || !accessToken) {
        return publicRows;
    }

    return fetchAllRows((path) => restGet(path, accessToken), basePath);
}

function toIsoOrNull(value) {
    const date = value ? new Date(value) : null;
    return date && !Number.isNaN(date.getTime()) ? date.toISOString() : null;
}

function pickSettledValue(result, fallback = []) {
    return result.status === "fulfilled" ? result.value : fallback;
}

function logRejected(label, result) {
    if (result.status === "rejected") {
        console.warn(label, result.reason);
    }
}

function resolveStoreFromList(list) {
    return list?.stores || list?.store_layouts?.stores || null;
}

function formatStoreLabel(store) {
    const name = String(store?.name || "").trim();
    const city = String(store?.city || "").trim();
    return [name, city].filter(Boolean).join(", ");
}

function aggregateMostUsedLayouts(layoutRows, usageRows) {
    if (!Array.isArray(usageRows) || usageRows.length === 0) {
        return [];
    }

    const byLayout = new Map();

    layoutRows.forEach((layout) => {
        const id = layout?.id;
        if (!id) return;

        byLayout.set(id, {
            id,
            storeName: layout?.stores?.name || "Okänd butik",
            city: layout?.stores?.city || "Okänd stad",
            users: new Set(),
        });
    });

    usageRows.forEach((row) => {
        const layoutId = row?.layout_id;
        const userId = row?.user_id;
        if (!layoutId || !userId) return;

        if (!byLayout.has(layoutId)) {
            byLayout.set(layoutId, {
                id: layoutId,
                storeName: "Okänd butik",
                city: "Okänd stad",
                users: new Set(),
            });
        }

        byLayout.get(layoutId).users.add(String(userId));
    });

    return Array.from(byLayout.values()).map((layout) => ({id: layout.id, storeName: layout.storeName, city: layout.city, likes: layout.users.size})).sort((a, b) => b.likes - a.likes || a.storeName.localeCompare(b.storeName, "sv") || a.city.localeCompare(b.city, "sv")).slice(0, 3);
}

function aggregateTopProducts(rows) {
    const byProduct = new Map();

    rows.forEach((row) => {
        const productId = row?.product_id;
        if (!productId) return;

        const quantity = Number(row?.quantity) > 0 ? Number(row.quantity) : 1;
        const existing = byProduct.get(productId) || { id: productId, name: row?.products?.name || "Okänd produkt", totalQuantity: 0, };

        existing.totalQuantity += quantity;
        byProduct.set(productId, existing);
    });

    return Array.from(byProduct.values()).sort((a, b) => b.totalQuantity - a.totalQuantity || a.name.localeCompare(b.name, "sv")).slice(0, 3);
}

function findMostCommonStore(lists) {
    const storeCounts = new Map();

    lists.forEach((list) => {
        const store = resolveStoreFromList(list);
        const storeLabel = formatStoreLabel(store);
        if (!storeLabel) return;
        storeCounts.set(storeLabel, (storeCounts.get(storeLabel) || 0) + 1);
    });

    const [storeLabel, count] = Array.from(storeCounts.entries()).sort((a, b) => b[1] - a[1])[0] || [];
    if (!storeLabel) return null;

    return `${storeLabel} (${count})`;
}

async function getLatestListsForUser(userId, accessToken) {
    const lists = await restGet(QUERY_LATEST_LISTS_FOR_USER(userId), accessToken);

    return lists.map((list) => {
        const resolvedStore = resolveStoreFromList(list);

        return {
            id: list.id,
            name: String(list.title || "Namnlös inköpslista"),
            updatedAt: toIsoOrNull(list.updated_at || list.created_at),
            isCompleted: Boolean(list.is_completed),
            storeName: resolvedStore?.name || null,
            storeCity: resolvedStore?.city || null,
        };
    });
}

async function getMostUsedLayouts(accessToken) {
    const [layoutRowsResult, usageRowsResult] = await Promise.allSettled([
        fetchAllRowsPublicThenAuth(QUERY_LAYOUTS, accessToken),
        fetchAllRowsPublicThenAuth(QUERY_LAYOUT_USAGE, accessToken),
    ]);

    const layoutRows = pickSettledValue(layoutRowsResult);
    const usageRows = pickSettledValue(usageRowsResult);

    return aggregateMostUsedLayouts(layoutRows, usageRows);
}

async function getTopPurchasedProducts(accessToken) {
    const rows = await fetchAllRowsPublicThenAuth(QUERY_TOP_PRODUCTS, accessToken);
    return aggregateTopProducts(rows);
}

async function getUserStats(userId, accessToken) {
    const lists = await restGet(QUERY_USER_STATS_LISTS(userId), accessToken);
    const members = await restGet(QUERY_USER_STATS_MEMBERS(userId), accessToken);
    const totalLists = lists.length;
    const completedLists = lists.filter((list) => Boolean(list?.is_completed)).length;
    const activeLists = Math.max(0, totalLists - completedLists);

    return {
        totalLists,
        activeLists,
        completedLists,
        sharedLists: members.length,
        mostCommonStore: findMostCommonStore(lists),
    };
}

export async function getHomeDashboardData() {
    const session = await getCurrentSession();
    const user = session?.user;

    if (!session?.access_token || !user?.id) {
        return { isAuthenticated: false, latestLists: [], topLayouts: [], topProducts: [], userStats: null, session };
    }

    const accessToken = session.access_token;
    const userId = user.id;

    const [latestListsResult, topLayoutsResult, topProductsResult, userStatsResult] = await Promise.allSettled([
        getLatestListsForUser(userId, accessToken),
        getMostUsedLayouts(accessToken),
        getTopPurchasedProducts(accessToken),
        getUserStats(userId, accessToken),
    ]);

    logRejected("Kunde inte hämta senaste inköpslistor:", latestListsResult);
    logRejected("Kunde inte hämta mest använda butikslayouter:", topLayoutsResult);
    logRejected("Kunde inte hämta mest inhandlade produkter:", topProductsResult);
    logRejected("Kunde inte hämta användarstatistik:", userStatsResult);

    return {
        isAuthenticated: true,
        latestLists: latestListsResult.status === "fulfilled" ? latestListsResult.value : [],
        topLayouts: topLayoutsResult.status === "fulfilled" ? topLayoutsResult.value : [],
        topProducts: topProductsResult.status === "fulfilled" ? topProductsResult.value : [],
        userStats: userStatsResult.status === "fulfilled" ? userStatsResult.value : null,
        session,
    };
}
