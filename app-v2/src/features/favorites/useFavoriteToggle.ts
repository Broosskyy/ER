import { usePathname } from 'expo-router';

import { useCallback } from 'react';



import type { SavedEventSource } from '@/features/saved/types/saved-event';



import type { EventId } from './types';

import { useFavorites } from './FavoritesContext';



function resolveFavoriteSource(pathname: string): SavedEventSource {

  if (pathname.includes('/saved')) {

    return 'saved';

  }



  if (pathname.includes('/search')) {

    return 'events';

  }



  if (pathname.includes('/map')) {

    return 'map';

  }



  if (pathname.includes('/event/')) {

    return 'detail';

  }



  if (pathname === '/' || pathname.endsWith('/index')) {

    return 'home';

  }



  return 'unknown';

}



/**

 * Favorite actions with local persistence for guest and signed-in users.

 */

export function useFavoriteToggle(returnTo?: string) {

  const favorites = useFavorites();

  const pathname = usePathname();

  const source = resolveFavoriteSource(pathname);



  const toggleFavorite = useCallback(

    (eventId: EventId) => {

      favorites.toggleFavorite(eventId, source);

    },

    [favorites, source],

  );



  return {

    ...favorites,

    toggleFavorite,

    returnTo,

  };

}


