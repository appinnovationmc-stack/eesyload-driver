-- Migration: fix protect_booking_financial_fields to allow the automatic
-- commission/payout calculation that fires on delivery.

CREATE OR REPLACE FUNCTION public.protect_booking_financial_fields()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  IF current_admin_role() IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'delivered' AND OLD.status IS DISTINCT FROM 'delivered' THEN
    IF NEW.base_fare IS DISTINCT FROM OLD.base_fare
       OR NEW.total_fare IS DISTINCT FROM OLD.total_fare
       OR NEW.addons_total IS DISTINCT FROM OLD.addons_total
       OR NEW.discount_amount IS DISTINCT FROM OLD.discount_amount
       OR NEW.commission_pct IS DISTINCT FROM OLD.commission_pct
       OR NEW.paystack_reference IS DISTINCT FROM OLD.paystack_reference
       OR NEW.load_surcharge_amount IS DISTINCT FROM OLD.load_surcharge_amount
       OR NEW.promo_code IS DISTINCT FROM OLD.promo_code
    THEN
      RAISE EXCEPTION 'Not permitted to modify financial fields on this booking';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.base_fare IS DISTINCT FROM OLD.base_fare
     OR NEW.total_fare IS DISTINCT FROM OLD.total_fare
     OR NEW.addons_total IS DISTINCT FROM OLD.addons_total
     OR NEW.discount_amount IS DISTINCT FROM OLD.discount_amount
     OR NEW.commission_pct IS DISTINCT FROM OLD.commission_pct
     OR NEW.commission_amount IS DISTINCT FROM OLD.commission_amount
     OR NEW.driver_payout IS DISTINCT FROM OLD.driver_payout
     OR NEW.payout_status IS DISTINCT FROM OLD.payout_status
     OR NEW.paystack_reference IS DISTINCT FROM OLD.paystack_reference
     OR NEW.load_surcharge_amount IS DISTINCT FROM OLD.load_surcharge_amount
     OR NEW.promo_code IS DISTINCT FROM OLD.promo_code
  THEN
    RAISE EXCEPTION 'Not permitted to modify financial fields on this booking';
  END IF;

  RETURN NEW;
END;
$function$;
