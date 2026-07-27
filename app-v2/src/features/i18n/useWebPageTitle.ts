import { useWebDocumentTitle } from '@/platform/web/use-web-document-title';
import { useAppTranslation } from '@/features/i18n/useAppTranslation';

type WebPageTitleKey =
  | 'webTitles.login'
  | 'webTitles.register'
  | 'webTitles.authCallback'
  | 'webTitles.forgotPassword'
  | 'webTitles.resetPassword'
  | 'webTitles.create'
  | 'webTitles.createEvent'
  | 'webTitles.createEventSuccess'
  | 'webTitles.editEvent'
  | 'webTitles.eventPreview'
  | 'webTitles.eventSubmitted'
  | 'webTitles.myEvents'
  | 'webTitles.organizerProfile'
  | 'webTitles.organizerProfileEdit'
  | 'webTitles.activity'
  | 'webTitles.notifications'
  | 'webTitles.profile';

export function useWebPageTitle(titleKey: WebPageTitleKey): void {
  const { t } = useAppTranslation();
  useWebDocumentTitle(t(titleKey));
}
