
-- Enum
CREATE TYPE public.category_type AS ENUM ('INCOME', 'EXPENSE', 'TRANSFER', 'INVESTMENT');

-- categories table
CREATE TABLE public.categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type public.category_type NOT NULL,
  color TEXT NOT NULL DEFAULT '#7C3AED',
  icon TEXT NOT NULL DEFAULT 'folder',
  display_order INTEGER NOT NULL DEFAULT 0,
  is_system BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX categories_unique_name_per_workspace
  ON public.categories (workspace_id, lower(name))
  WHERE deleted_at IS NULL;

CREATE INDEX categories_workspace_idx ON public.categories(workspace_id) WHERE deleted_at IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT ALL ON public.categories TO service_role;

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view categories of own workspaces" ON public.categories
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = categories.workspace_id AND w.owner_id = auth.uid()));

CREATE POLICY "Owners can insert categories in own workspaces" ON public.categories
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = categories.workspace_id AND w.owner_id = auth.uid()));

CREATE POLICY "Owners can update categories of own workspaces" ON public.categories
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = categories.workspace_id AND w.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = categories.workspace_id AND w.owner_id = auth.uid()));

CREATE POLICY "Owners can delete categories of own workspaces" ON public.categories
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = categories.workspace_id AND w.owner_id = auth.uid()));

CREATE TRIGGER categories_set_updated_at
  BEFORE UPDATE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- subcategories table
CREATE TABLE public.subcategories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_system BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX subcategories_unique_name_per_category
  ON public.subcategories (category_id, lower(name))
  WHERE deleted_at IS NULL;

CREATE INDEX subcategories_category_idx ON public.subcategories(category_id) WHERE deleted_at IS NULL;
CREATE INDEX subcategories_workspace_idx ON public.subcategories(workspace_id) WHERE deleted_at IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.subcategories TO authenticated;
GRANT ALL ON public.subcategories TO service_role;

ALTER TABLE public.subcategories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view subcategories of own workspaces" ON public.subcategories
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = subcategories.workspace_id AND w.owner_id = auth.uid()));

CREATE POLICY "Owners can insert subcategories in own workspaces" ON public.subcategories
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = subcategories.workspace_id AND w.owner_id = auth.uid()));

CREATE POLICY "Owners can update subcategories of own workspaces" ON public.subcategories
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = subcategories.workspace_id AND w.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = subcategories.workspace_id AND w.owner_id = auth.uid()));

CREATE POLICY "Owners can delete subcategories of own workspaces" ON public.subcategories
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = subcategories.workspace_id AND w.owner_id = auth.uid()));

CREATE TRIGGER subcategories_set_updated_at
  BEFORE UPDATE ON public.subcategories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed function
CREATE OR REPLACE FUNCTION public.seed_default_categories(_workspace_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cat_id UUID;
  seed JSONB := '[
    {"name":"Receitas","type":"INCOME","color":"#10B981","icon":"trending-up","subs":["Salário","Férias","13º Salário","Dividendos","Juros","Rendimentos","Aluguel","Outros"]},
    {"name":"Moradia","type":"EXPENSE","color":"#F59E0B","icon":"home","subs":["Aluguel","Condomínio","Água","Energia","Gás","Internet","IPTU","Manutenção"]},
    {"name":"Alimentação","type":"EXPENSE","color":"#EF4444","icon":"utensils","subs":["Mercado","Restaurante","Padaria","Delivery"]},
    {"name":"Transporte","type":"EXPENSE","color":"#3B82F6","icon":"car","subs":["Combustível","Manutenção","Seguro","IPVA","Estacionamento","Uber","Ônibus"]},
    {"name":"Saúde","type":"EXPENSE","color":"#EC4899","icon":"heart-pulse","subs":["Farmácia","Consultas","Plano de Saúde","Exames"]},
    {"name":"Educação","type":"EXPENSE","color":"#8B5CF6","icon":"graduation-cap","subs":["Escola","Faculdade","Cursos","Livros"]},
    {"name":"Lazer","type":"EXPENSE","color":"#06B6D4","icon":"party-popper","subs":["Cinema","Viagens","Streaming","Jogos"]},
    {"name":"Assinaturas","type":"EXPENSE","color":"#0EA5E9","icon":"repeat","subs":["Netflix","Spotify","ChatGPT","Outros"]},
    {"name":"Impostos","type":"EXPENSE","color":"#64748B","icon":"landmark","subs":["IR","Taxas","Multas"]},
    {"name":"Investimentos","type":"INVESTMENT","color":"#22C55E","icon":"line-chart","subs":["Compra","Venda","Dividendos","Juros","Rendimentos"]},
    {"name":"Transferências","type":"TRANSFER","color":"#7C3AED","icon":"arrow-left-right","subs":["Entre Contas"]},
    {"name":"Outros","type":"EXPENSE","color":"#94A3B8","icon":"folder","subs":["Diversos"]}
  ]'::jsonb;
  cat JSONB;
  sub TEXT;
  cat_order INT := 0;
  sub_order INT;
BEGIN
  FOR cat IN SELECT * FROM jsonb_array_elements(seed)
  LOOP
    -- Skip if category with same name already exists (idempotent)
    SELECT id INTO cat_id FROM public.categories
      WHERE workspace_id = _workspace_id
        AND lower(name) = lower(cat->>'name')
        AND deleted_at IS NULL
      LIMIT 1;

    IF cat_id IS NULL THEN
      INSERT INTO public.categories (workspace_id, name, type, color, icon, display_order, is_system)
      VALUES (
        _workspace_id,
        cat->>'name',
        (cat->>'type')::public.category_type,
        cat->>'color',
        cat->>'icon',
        cat_order,
        true
      ) RETURNING id INTO cat_id;
    END IF;

    sub_order := 0;
    FOR sub IN SELECT jsonb_array_elements_text(cat->'subs')
    LOOP
      INSERT INTO public.subcategories (category_id, workspace_id, name, display_order, is_system)
      VALUES (cat_id, _workspace_id, sub, sub_order, true)
      ON CONFLICT DO NOTHING;
      sub_order := sub_order + 1;
    END LOOP;

    cat_order := cat_order + 1;
  END LOOP;
END;
$$;

-- Update handle_new_user to seed categories
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  display_name TEXT;
  new_ws_id UUID;
BEGIN
  display_name := COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1));

  INSERT INTO public.profiles (id, email, name, avatar_url)
  VALUES (NEW.id, NEW.email, display_name, NEW.raw_user_meta_data->>'avatar_url');

  INSERT INTO public.workspaces (owner_id, name)
  VALUES (NEW.id, 'Meu Workspace')
  RETURNING id INTO new_ws_id;

  PERFORM public.seed_default_categories(new_ws_id);

  RETURN NEW;
END;
$$;

-- Backfill existing workspaces
DO $$
DECLARE
  ws RECORD;
BEGIN
  FOR ws IN SELECT id FROM public.workspaces WHERE deleted_at IS NULL LOOP
    PERFORM public.seed_default_categories(ws.id);
  END LOOP;
END;
$$;
