-- 1. Grant table-level permissions to authenticated role
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.teams TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.team_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.team_invitations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.team_activities TO authenticated;

-- 2. Update team_has_live_subscription to recognise platform admins
CREATE OR REPLACE FUNCTION public.team_has_live_subscription(p_team_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID := auth.uid();
  v_is_service BOOLEAN := COALESCE(auth.role() = 'service_role', false);
  v_email TEXT := lower(COALESCE(auth.jwt() ->> 'email', ''));
  v_owner_id UUID;
BEGIN
  IF p_team_id IS NULL THEN
    RETURN false;
  END IF;

  -- 1. Platform admin check on team owner or current caller
  SELECT owner_id INTO v_owner_id FROM public.teams WHERE id = p_team_id;
  IF v_owner_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.profiles WHERE id = v_owner_id AND role = 'admin'
  ) THEN
    RETURN true;
  END IF;

  IF v_user_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.profiles WHERE id = v_user_id AND role = 'admin'
  ) THEN
    RETURN true;
  END IF;

  -- 2. Browser caller must be an active member, or the specific pending invitee
  IF NOT v_is_service THEN
    IF v_user_id IS NULL THEN
      RETURN false;
    END IF;
    IF NOT EXISTS (
      SELECT 1
      FROM public.team_members tm
      WHERE tm.team_id = p_team_id AND tm.user_id = v_user_id
    ) AND NOT EXISTS (
      SELECT 1
      FROM public.team_invitations ti
      WHERE ti.team_id = p_team_id
        AND ti.status = 'pending'
        AND ti.expires_at > now()
        AND v_email <> ''
        AND lower(ti.email) = v_email
    ) THEN
      RETURN false;
    END IF;
  END IF;

  -- 3. Live Stripe subscription check
  RETURN EXISTS (
    SELECT 1
    FROM public.billing_accounts ba
    JOIN public.workspace_subscriptions ws ON ws.billing_account_id = ba.id
    JOIN public.teams t ON t.id = ba.team_id
    WHERE ba.team_id = p_team_id
      AND ba.account_kind = 'team'
      AND ba.status = 'active'
      AND t.deleted_at IS NULL
      AND ws.tier = 'team'
      AND public.stripe_subscription_is_live(ws.status, ws.current_period_end, ws.trial_end)
  );
END;
$function$;

-- 3. Update has_active_team_seat to support team owner and platform admin
CREATE OR REPLACE FUNCTION public.has_active_team_seat(p_team_id uuid, p_user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF p_team_id IS NULL OR p_user_id IS NULL THEN
    RETURN false;
  END IF;
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RETURN false;
  END IF;

  -- 1. Platform admin check
  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = p_user_id AND role = 'admin'
  ) THEN
    RETURN EXISTS (
      SELECT 1 FROM public.teams t
      WHERE t.id = p_team_id AND t.deleted_at IS NULL
        AND (
          t.owner_id = p_user_id
          OR EXISTS (
            SELECT 1 FROM public.team_members tm
            WHERE tm.team_id = p_team_id AND tm.user_id = p_user_id
          )
        )
    );
  END IF;

  -- 2. Team owner check during/after creation if user has team_workspace feature
  IF EXISTS (
    SELECT 1 FROM public.teams t
    WHERE t.id = p_team_id AND t.owner_id = p_user_id AND t.deleted_at IS NULL
  ) AND public.can_use_feature(p_user_id, 'team_workspace') THEN
    RETURN true;
  END IF;

  -- 3. Standard active team seat check with live subscription
  RETURN EXISTS (
    SELECT 1
    FROM public.team_members tm
    JOIN public.teams t ON t.id = tm.team_id
    WHERE tm.team_id = p_team_id
      AND tm.user_id = p_user_id
      AND t.deleted_at IS NULL
      AND public.team_has_live_subscription(t.id)
  );
END;
$function$;

-- 4. Automatically link pending team billing account upon team creation
CREATE OR REPLACE FUNCTION public.on_team_created_link_billing()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.billing_accounts
  SET team_id = NEW.id,
      account_kind = 'team',
      pending_team_expires_at = NULL,
      updated_at = now()
  WHERE owner_user_id = NEW.owner_id
    AND account_kind = 'team_pending'
    AND status = 'active';

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_link_billing_on_team_created ON public.teams;
CREATE TRIGGER trigger_link_billing_on_team_created
  AFTER INSERT ON public.teams
  FOR EACH ROW
  EXECUTE FUNCTION public.on_team_created_link_billing();
