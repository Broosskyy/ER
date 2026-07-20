export { AuthProvider, useAuth } from '@/features/auth/AuthContext';
export type { SignUpResult } from '@/services/supabase/auth-service';
export {
  buildLoginHref,
  buildRegisterHref,
  buildForgotPasswordHref,
  CREATE_HUB_RETURN_ROUTE,
  getCreateAuthLinks,
  getProfileAuthLinks,
  isSafeReturnRoute,
  PROFILE_RETURN_ROUTE,
  resolveProfileAuthView,
} from '@/features/auth/auth-route-utils';
