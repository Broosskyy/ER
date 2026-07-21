import { cityRepository } from '@/data/repositories/registry';
import { filterConfig } from '@/features/search/config/filter-config';

/**
 * Resolves a valid `city_id` FK against active cities in the current datasource.
 * Prevents FK violations when staging seed IDs differ from local filter-config IDs.
 */
export async function resolveContributorCityId(existingCityId?: string): Promise<string | undefined> {
  const cities = await cityRepository.getActive();
  if (cities.length === 0) {
    return existingCityId;
  }

  if (existingCityId && cities.some((city) => city.id === existingCityId)) {
    return existingCityId;
  }

  const preferred =
    cities.find((city) => city.id === filterConfig.defaultCityId) ??
    cities.find((city) => city.slug === filterConfig.defaultCityId) ??
    cities[0];

  return preferred?.id;
}
