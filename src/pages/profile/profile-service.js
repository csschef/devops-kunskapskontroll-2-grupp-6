import { supabase } from "../../api-service.js";

export async function getUserShoppingLists() {
	const { data, error } = await supabase
		.from("shopping_lists")
		.select("id, title, is_completed, created_at, shopping_list_items(id, custom_name, is_checked)")
		.order("created_at", { ascending: false });

	if (error) throw error;

	return data ?? [];
}

export async function getUserLayouts() {
	const { data, error } = await supabase
		.from("store_layouts")
		.select("id, name, created_at, stores(name, city)")
		.order("created_at", { ascending: false });
 
	if (error) throw error;
 
	return data ?? [];
}