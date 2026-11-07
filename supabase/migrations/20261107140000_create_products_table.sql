-- Create products table for e-commerce and product catalog
CREATE TABLE IF NOT EXISTS public.products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  price_cents INTEGER NOT NULL DEFAULT 0,
  promotional_price_cents INTEGER DEFAULT NULL,
  category TEXT DEFAULT '',
  image_url TEXT DEFAULT '',
  additional_images JSONB DEFAULT '[]'::jsonb,
  video_type TEXT DEFAULT 'none',
  video_url TEXT DEFAULT '',
  checkout_url TEXT DEFAULT '',
  stock INTEGER DEFAULT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Policy for tenant members
CREATE POLICY "Members can manage products"
ON public.products FOR ALL
USING (is_tenant_member(auth.uid(), tenant_id))
WITH CHECK (is_tenant_member(auth.uid(), tenant_id));

-- Updated at trigger
CREATE TRIGGER update_products_updated_at
BEFORE UPDATE ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
