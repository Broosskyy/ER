import type { EventDisplayModel } from '@/features/events/formatting/display-event';
import type { EventFilters } from '@/features/search/constants';

export function filterDisplayEvents(
  events: EventDisplayModel[],
  filters: EventFilters,
): EventDisplayModel[] {
  let result = events;

  if (filters.city.trim()) {
    const city = filters.city.trim().toLowerCase();
    result = result.filter((event) => event.city.toLowerCase() === city);
  }

  if (filters.genres.length > 0) {
    const genres = filters.genres.map((genre) => genre.toLowerCase());
    result = result.filter((event) =>
      event.genres.some((genre) => genres.includes(genre.toLowerCase())),
    );
  }

  const query = filters.query.trim().toLowerCase();
  if (query) {
    result = result.filter((event) => {
      const haystack = [
        event.title,
        event.description,
        event.venue,
        event.city,
        ...event.genres,
        ...event.artists,
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }

  return result;
}
