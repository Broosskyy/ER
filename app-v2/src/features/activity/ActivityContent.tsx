import { EmptyState } from '@/components/feedback/EmptyState';

export function ActivityContent(_props: { presentation?: 'screen' | 'embedded' }) {
  return (
    <EmptyState
      title="Keine Aktivitäten"
      description="Aktivitäten erscheinen hier, sobald der neue Event-Core Events enthält."
    />
  );
}
