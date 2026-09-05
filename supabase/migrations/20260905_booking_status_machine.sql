-- Authoritative trip status transitions.
CREATE OR REPLACE FUNCTION public.enforce_booking_status_machine()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  IF OLD.status = 'pending' AND NEW.status IN ('accepted', 'cancelled_driver', 'cancelled_customer') THEN
    RETURN NEW;
  END IF;

  IF OLD.status = 'accepted' AND NEW.status IN ('loading', 'in_transit', 'delivered', 'cancelled_driver') THEN
    RETURN NEW;
  END IF;

  IF OLD.status = 'loading' AND NEW.status IN ('in_transit', 'delivered', 'cancelled_driver') THEN
    RETURN NEW;
  END IF;

  IF OLD.status = 'in_transit' AND NEW.status IN ('delivered') THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Invalid booking status transition: % -> %', OLD.status, NEW.status;
END;
$function$;

DROP TRIGGER IF EXISTS trg_enforce_booking_status_machine ON public.bookings;
CREATE TRIGGER trg_enforce_booking_status_machine
  BEFORE UPDATE OF status ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION enforce_booking_status_machine();
