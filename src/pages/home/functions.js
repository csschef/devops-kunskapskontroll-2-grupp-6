export function resolveDisplayName({ profile, session }) {
    const fromProfile = String(profile?.name || "").trim();
    if (fromProfile) return fromProfile;

    const userMeta = session?.user?.user_metadata;
    const firstName = String(userMeta?.first_name || "").trim();
    const lastName = String(userMeta?.last_name || "").trim();
    const fullName = `${firstName} ${lastName}`.trim();
    if (fullName) return fullName;

    return String(userMeta?.name || session?.user?.email || "").trim();
}

function escapeHtml(text) {
    return String(text || "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

function formatRelativeDate(isoDate) {
    if (!isoDate) return "Uppdaterad nyligen";

    const date = new Date(isoDate);
    if (Number.isNaN(date.getTime())) return "Uppdaterad nyligen";

    const diffMs = Date.now() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) return "Uppdaterad idag";
    if (diffDays === 1) return "Uppdaterad igår";
    if (diffDays < 7) return `Uppdaterad för ${diffDays} dagar sedan`;

    return `Uppdaterad ${date.toLocaleDateString("sv-SE")}`;
}

export function createLatestListsMarkup(lists = []) {
    return lists.map((list) => {
        const storeAndCity = `${list?.storeName || "Okänd butik"}${list?.storeCity ? ` ${list.storeCity}` : ""}`;
        return `
            <article class="home-list-row" aria-label="Inköpslista">
                <div>
                    <p class="home-list-name">${escapeHtml(list?.name || "Namnlös inköpslista")}</p>
                    <p class="home-list-subline">${escapeHtml(storeAndCity)}, ${formatRelativeDate(list?.updatedAt)}</p>
                </div>
                <a href="/list/${encodeURIComponent(String(list?.id || ""))}" class="btn btn-secondary btn-small home-list-link" aria-label="Visa inköpslista ${escapeHtml(list?.name || "")}">Visa</a>
            </article>
        `;
    }).join("");
}

export function createTopLayoutsMarkup(layouts = []) {
    return layouts.map((layout) => {
        return `
            <article class="home-list-row" aria-label="Butikslayout">
                <div>
                    <p class="home-list-name">${escapeHtml(layout?.storeName || "Okänd butik")}</p>
                    <p class="home-list-subline">${escapeHtml(layout?.city || "Okänd stad")}</p>
                </div>
                <span class="home-rating" aria-label="${Number(layout?.likes) || 0} användare"><i class="ti ti-star"></i> ${Number(layout?.likes) || 0}</span>
            </article>
        `;
    }).join("");
}

export function createTopProductsMarkup(products = []) {
    return products.map((product) => `
        <article class="home-list-row" aria-label="Populär produkt">
            <div>
                <p class="home-list-name">${escapeHtml(product?.name || "Okänd produkt")}</p>
                <p class="home-list-subline">Inköpt ${Number(product?.totalQuantity) || 0} gånger</p>
            </div>
            <span class="status-badge status-warning popular">Populär</span>
        </article>
    `).join("");
}

export function createStatsMarkup(stats) {
    if (!stats) return createEmptyStateMarkup("Ingen statistik tillgänglig än.");

    const mostCommonStore = stats.mostCommonStore || "Ingen butik ännu";

    return `
        <div class="home-stats-grid">
            <article class="home-stat-card">
                <p class="home-stat-label">Antal listor</p>
                <p class="home-stat-value">${Number(stats.totalLists) || 0}</p>
            </article>
            <article class="home-stat-card">
                <p class="home-stat-label">Aktiva listor</p>
                <p class="home-stat-value">${Number(stats.activeLists) || 0}</p>
            </article>
            <article class="home-stat-card">
                <p class="home-stat-label">Avklarade listor</p>
                <p class="home-stat-value">${Number(stats.completedLists) || 0}</p>
            </article>
            <article class="home-stat-card">
                <p class="home-stat-label">Mest använd butik</p>
                <p class="home-stat-value home-stat-value-small">${escapeHtml(mostCommonStore)}</p>
            </article>
        </div>
    `;
}

export function createEmptyStateMarkup(text) {
    return `<p class="home-locked-message">${escapeHtml(text)}</p>`;
}