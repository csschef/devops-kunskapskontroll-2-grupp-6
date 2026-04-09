-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.categories (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text,
  CONSTRAINT categories_pkey PRIMARY KEY (id)
);
CREATE TABLE public.products (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text,
  category_id uuid,
  created_by uuid,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT products_pkey PRIMARY KEY (id),
  CONSTRAINT products_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id),
  CONSTRAINT products_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.profiles (
  id uuid NOT NULL,
  email text,
  name text,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey_auth_users FOREIGN KEY (id) REFERENCES auth.users(id)
);
CREATE TABLE public.purchase_history (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  product_id uuid,
  store_id uuid,
  quantity integer,
  purchased_at timestamp without time zone DEFAULT now(),
  CONSTRAINT purchase_history_pkey PRIMARY KEY (id),
  CONSTRAINT purchase_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT purchase_history_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id),
  CONSTRAINT purchase_history_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id)
);
CREATE TABLE public.shopping_list_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  shopping_list_id uuid,
  product_id uuid,
  custom_name text,
  notes text,
  is_checked boolean DEFAULT false,
  checked_at timestamp without time zone,
  added_at timestamp without time zone DEFAULT now(),
  CONSTRAINT shopping_list_items_pkey PRIMARY KEY (id),
  CONSTRAINT shopping_list_items_shopping_list_id_fkey FOREIGN KEY (shopping_list_id) REFERENCES public.shopping_lists(id),
  CONSTRAINT shopping_list_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id)
);
CREATE TABLE public.shopping_list_members (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  shopping_list_id uuid,
  user_id uuid,
  role text,
  invited_at timestamp without time zone DEFAULT now(),
  CONSTRAINT shopping_list_members_pkey PRIMARY KEY (id),
  CONSTRAINT shopping_list_members_shopping_list_id_fkey FOREIGN KEY (shopping_list_id) REFERENCES public.shopping_lists(id),
  CONSTRAINT shopping_list_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.shopping_lists (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  store_id uuid,
  layout_id uuid,
  title text,
  is_completed boolean DEFAULT false,
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone,
  CONSTRAINT shopping_lists_pkey PRIMARY KEY (id),
  CONSTRAINT shopping_lists_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id),
  CONSTRAINT shopping_lists_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id),
  CONSTRAINT shopping_lists_layout_id_fkey FOREIGN KEY (layout_id) REFERENCES public.store_layouts(id)
);
CREATE TABLE public.store_category_order (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  layout_id uuid,
  category_id uuid,
  display_order integer,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT store_category_order_pkey PRIMARY KEY (id),
  CONSTRAINT store_category_order_layout_id_fkey FOREIGN KEY (layout_id) REFERENCES public.store_layouts(id),
  CONSTRAINT store_category_order_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id)
);
CREATE TABLE public.store_layouts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  store_id uuid,
  created_by uuid,
  name text,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT store_layouts_pkey PRIMARY KEY (id),
  CONSTRAINT store_layouts_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id),
  CONSTRAINT store_layouts_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.stores (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text,
  city text,
  created_by uuid,
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone,
  CONSTRAINT stores_pkey PRIMARY KEY (id),
  CONSTRAINT stores_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id)
);