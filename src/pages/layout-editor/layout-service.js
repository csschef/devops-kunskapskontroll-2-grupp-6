import { supabase } from "../../api-service.js";

const SECTION_CATEGORIES_TABLE = "categories";

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

export async function fetchSectionCategories() {
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