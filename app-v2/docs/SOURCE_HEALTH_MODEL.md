# Source Health Model

## Resolver

`SourceHealthResolver` — `src/features/sources/domain/source-health-resolver.ts`

## Output

```typescript
{
  status: 'healthy' | 'warning' | 'degraded' | 'critical' | 'unknown';
  score: 0..100;
  reasons: string[];
  recommendations: string[];
}
```

## Inputs (real metrics only)

- `consecutiveFailureCount`
- `errorRate`, `duplicateRate`
- `lastSuccessfulSyncAt` (staleness policy: 72h)
- `averageDurationMs` when available

## Policy thresholds

| Signal | Threshold |
|--------|-----------|
| Warning failures | 2 consecutive |
| Degraded | 3 consecutive |
| Critical | 5 consecutive |
| Stale sync | > 72 hours |

Health measures **technical reliability**, not content completeness.
