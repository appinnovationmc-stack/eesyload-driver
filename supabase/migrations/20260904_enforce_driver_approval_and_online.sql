-- Enforce: only approved drivers may go online or accept bookings.
-- Apply in the Supabase SQL editor against the live project.
-- Client gates are not sufficient on their own.

CREATE OR REPLACE FUNCTION public.enforce_driver_online_requires_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  IF NEW.is_online IS TRUE
     AND COALESCE(NEW.driver_status, '') NOT IN ('approved', 'active') THEN
    RAISE EXCEPTION 'Not permitted: only approved drivers can go online';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_enforce_driver_online_requires_approval ON public.profiles;
CREATE TRIGGER trg_enforce_driver_online_requires_approval
  BEFORE INSERT OR UPDATE OF is_online, driver_status ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION enforce_driver_online_requires_approval();

CREATE OR REPLACE FUNCTION public.enforce_only_approved_driver_can_accept()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  st text;
BEGIN
  IF NEW.driver_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF OLD.driver_id IS DISTINCT FROM NEW.driver_id
     OR (OLD.status = 'pending' AND NEW.status = 'accepted') THEN
    SELECT driver_status INTO st FROM public.profiles WHERE id = NEW.driver_id;
    IF st IS NULL OR st NOT IN ('approved', 'active') THEN
      RAISE EXCEPTION 'Not permitted: only approved drivers can accept bookings';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_enforce_only_approved_driver_can_accept ON public.bookings;
CREATE TRIGGER trg_enforce_only_approved_driver_can_accept
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION enforce_only_approved_driver_can_accept();
