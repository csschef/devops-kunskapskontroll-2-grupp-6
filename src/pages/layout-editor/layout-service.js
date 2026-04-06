import { supabase } from "../../api-service.js";

const SECTION_CATEGORIES_TABLE = "categories";

function uniqueNames(names) {
	const seen = new Set();
	const normalizedNames = [];

	for (const rawName of names) {
		const name = String(rawName || "").trim();

		if (!name) continue;
		if (seen.has(name.toLowerCase())) continue;

		seen.add(name.toLowerCase());
		normalizedNames.push(name);
	}

	return normalizedNames;
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

	const names = Array.isArray(data) ? data.map((row) => row?.name) : [];
	return uniqueNames(names);
}