/** Subtle dark styling for Google Maps — aligns with Eternal Rave surfaces. */
export const eternalRaveMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#12121a' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#9ca3af' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0b0b0f' }] },
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [{ color: '#1f1f27' }],
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#15151b' }],
  },
  {
    featureType: 'poi',
    elementType: 'geometry',
    stylers: [{ color: '#15151b' }],
  },
] ;
