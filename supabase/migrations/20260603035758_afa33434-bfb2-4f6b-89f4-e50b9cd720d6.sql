
-- 1. Product variants
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS colors TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS sizes TEXT[] NOT NULL DEFAULT '{}';

-- 2. Notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  link TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'general',
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own notifications" ON public.notifications
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR has_role(auth.uid(),'admin'));
CREATE POLICY "Users update own notifications" ON public.notifications
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own notifications" ON public.notifications
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Anyone authenticated can insert notifications" ON public.notifications
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE INDEX IF NOT EXISTS notifications_user_idx ON public.notifications(user_id, created_at DESC);
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- 3. Follows
CREATE TABLE IF NOT EXISTS public.follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID NOT NULL,
  artisan_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (follower_id, artisan_id)
);
GRANT SELECT, INSERT, DELETE ON public.follows TO authenticated;
GRANT ALL ON public.follows TO service_role;
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Follows viewable" ON public.follows FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users manage own follows" ON public.follows
  FOR ALL TO authenticated USING (auth.uid() = follower_id) WITH CHECK (auth.uid() = follower_id);

-- 4. Trigger: notify customer & artisan on order events
CREATE OR REPLACE FUNCTION public.notify_order_event()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _artisan UUID;
  _title TEXT;
  _stage_label TEXT;
BEGIN
  SELECT artisan_id INTO _artisan FROM public.products WHERE id = NEW.product_id;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.notifications(user_id, title, body, link, category)
    VALUES (NEW.customer_id, 'Order placed', 'Your order has been placed successfully.', '/customer-orders', 'order');
    IF _artisan IS NOT NULL THEN
      INSERT INTO public.notifications(user_id, title, body, link, category)
      VALUES (_artisan, 'New order received', 'A customer placed a new order on your product.', '/artisan-orders', 'order');
    END IF;
    INSERT INTO public.notifications(user_id, title, body, link, category)
    SELECT user_id, 'New order placed', 'A new order was placed in the marketplace.', '/admin-dashboard', 'admin'
    FROM public.user_roles WHERE role = 'admin';
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.order_status IS DISTINCT FROM OLD.order_status THEN
    _stage_label := CASE NEW.order_status
      WHEN 'accepted' THEN 'Your order was accepted by the artisan.'
      WHEN 'preparing' THEN 'Your order is now being prepared.'
      WHEN 'shipped' THEN 'Your order has been shipped.'
      WHEN 'out_for_delivery' THEN 'Your order is out for delivery.'
      WHEN 'delivered' THEN 'Your order was delivered successfully.'
      ELSE 'Your order status has been updated.'
    END;
    INSERT INTO public.notifications(user_id, title, body, link, category)
    VALUES (NEW.customer_id, 'Order update', _stage_label, '/customer-orders', 'order');
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_notify_order ON public.orders;
CREATE TRIGGER trg_notify_order
  AFTER INSERT OR UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.notify_order_event();

-- 5. Trigger: notify followers on new product + admin
CREATE OR REPLACE FUNCTION public.notify_new_product()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _artisan_name TEXT;
BEGIN
  SELECT full_name INTO _artisan_name FROM public.profiles WHERE id = NEW.artisan_id;
  INSERT INTO public.notifications(user_id, title, body, link, category)
  SELECT f.follower_id, COALESCE(_artisan_name,'An artisan') || ' added a new product',
         NEW.title, '/product/' || NEW.id::text, 'product'
  FROM public.follows f WHERE f.artisan_id = NEW.artisan_id;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_notify_new_product ON public.products;
CREATE TRIGGER trg_notify_new_product
  AFTER INSERT ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_product();

-- 6. Trigger: notify admin on new profile
CREATE OR REPLACE FUNCTION public.notify_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.notifications(user_id, title, body, link, category)
  SELECT user_id, 'New user registered', COALESCE(NEW.full_name, NEW.email) || ' joined HunarHub.', '/admin-dashboard', 'admin'
  FROM public.user_roles WHERE role = 'admin';
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_notify_new_user ON public.profiles;
CREATE TRIGGER trg_notify_new_user
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_user();
