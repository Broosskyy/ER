# Connector Capabilities

Einheitliches Capability-Modell für alle `SourceConnector`-Implementierungen.

## Struktur

```typescript
interface SourceConnectorCapabilities {
  supportsPagination: boolean;
  supportsDeltaImports: boolean;
  supportsImages: boolean;
  supportsArtists: boolean;
  supportsVenueCoordinates: boolean;
  supportsGenres: boolean;
  supportsTicketLinks: boolean;
  supportsTimezone: boolean;
  supportsWebhooks: boolean;
  supportsRateLimits: boolean;
  supportsAuthentication: boolean;
}
```

Alle Connectoren implementieren `describeCapabilities()` über `BaseSourceConnector` — keine Sonderbehandlung pro Connector.

## Capability-Matrix

| Capability | manual_reference | club_website | organizer_website | ical_feed | open_data_api |
|------------|:---:|:---:|:---:|:---:|:---:|
| supportsPagination | — | — | — | — | ✓ |
| supportsDeltaImports | — | — | — | — | ✓ |
| supportsImages | ✓ | ✓ | ✓ | — | ✓ |
| supportsArtists | ✓ | ✓ | ✓ | — | ✓ |
| supportsVenueCoordinates | ✓ | ✓ | ✓ | — | ✓ |
| supportsGenres | ✓ | — | — | — | ✓ |
| supportsTicketLinks | ✓ | ✓ | ✓ | ✓ | ✓ |
| supportsTimezone | ✓ | — | — | ✓ | ✓ |
| supportsWebhooks | — | — | — | — | — |
| supportsRateLimits | — | — | — | — | ✓ |
| supportsAuthentication | — | — | — | optional | ✓ |

## API

```typescript
const registry = createDefaultSourceConnectorRegistry();
const capabilities = registry.get('open_data_api').describeCapabilities();
const descriptor = registry.getDescriptor('open_data_api');
```

## Factory

```typescript
createSourceConnectorCapabilities({
  supportsPagination: true,
  supportsAuthentication: true,
});
```

Fehlende Felder werden auf `false` gesetzt.

## Hinweise

- Capabilities sind **deklarativ** — sie beschreiben Unterstützung, erzwingen aber noch kein Verhalten.
- `supportsPagination: true` bei `open_data_api` bedeutet: API kann paginiert werden; automatische Pagination folgt in einer späteren Phase.
