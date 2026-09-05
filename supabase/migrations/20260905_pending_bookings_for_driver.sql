-- Live function uses vehicle_name only (bookings.vehicle does not exist).
CREATE OR REPLACE FUNCTION public.pending_bookings_for_driver(
  p_vehicle text DEFAULT NULL,
  p_lat double precision DEFAULT NULL,
  p_lng double precision DEFAULT NULL,
  p_radius_km double precision DEFAULT 30
)
RETURNS SETOF public.bookings
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $function$
DECLARE
  v text;
BEGIN
  v := lower(regexp_replace(coalesce(p_vehicle, ''), '[^a-z0-9]+', '', 'g'));
  RETURN QUERY
  SELECT b.*
  FROM public.bookings b
  WHERE b.status = 'pending'
    AND b.driver_id IS NULL
    AND (
      v = ''
      OR lower(regexp_replace(coalesce(b.vehicle_name, ''), '[^a-z0-9]+', '', 'g')) = v
      OR lower(coalesce(b.vehicle_name, '')) LIKE '%' || v || '%'
    )
    AND (
      p_lat IS NULL OR p_lng IS NULL
      OR b.pickup_lat IS NULL OR b.pickup_lng IS NULL
      OR (
        6371 * acos(
          least(1.0, greatest(-1.0,
            cos(radians(p_lat)) * cos(radians(b.pickup_lat)) *
            cos(radians(b.pickup_lng) - radians(p_lng)) +
            sin(radians(p_lat)) * sin(radians(b.pickup_lat))
          ))
        ) <= coalesce(p_radius_km, 30)
      )
    )
  ORDER BY b.created_at DESC;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.pending_bookings_for_driver(text, double precision, double precision, double precision) TO authenticated;
