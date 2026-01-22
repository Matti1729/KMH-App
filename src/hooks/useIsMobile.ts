import { useWindowDimensions } from 'react-native';

const MOBILE_BREAKPOINT = 768;

export function useIsMobile() {
  const { width } = useWindowDimensions();
  return width < MOBILE_BREAKPOINT;
}
