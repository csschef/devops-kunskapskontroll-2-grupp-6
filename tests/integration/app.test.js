import { describe, test, expect, it, beforeEach, vi } from "vitest";

async function getSupabaseClient() {
	const { supabase } = await import('../../src/api/supabase.js')
	return supabase
}

describe("app integration", () => {
	test("runs a basic integration smoke test", () => {
		expect(true).toBe(true);
	});
});

// Database connection test
describe('Supabase connection', () => {
  it('should connect to the database', async () => {
	const supabase = await getSupabaseClient()

	const { data, error } = await supabase
	  .from('products')
	  .select('*')
	  .limit(1)

	expect(error).toBeNull()
	expect(data).toBeDefined()
  })
})