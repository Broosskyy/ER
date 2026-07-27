export interface EventIdAliasRepository {
  findCanonicalId(eventId: string): Promise<string | null>;
}

export class CanonicalEventIdResolver {
  constructor(private readonly aliases: EventIdAliasRepository) {}

  async resolve(eventId: string): Promise<string> {
    return (await this.aliases.findCanonicalId(eventId)) ?? eventId;
  }

  async deduplicate<T extends { id: string }>(events: T[]): Promise<T[]> {
    const resolved = await Promise.all(
      events.map(async (event) => ({ event, canonicalId: await this.resolve(event.id) })),
    );
    const seen = new Set<string>();
    return resolved.filter(({ canonicalId }) => {
      if (seen.has(canonicalId)) return false;
      seen.add(canonicalId);
      return true;
    }).map(({ event, canonicalId }) => canonicalId === event.id ? event : { ...event, id: canonicalId });
  }
}
