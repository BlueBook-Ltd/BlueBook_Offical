import { useEffect } from 'react';
import LittlestTokyo from '@/components/LittlestTokyo';
import '@/styles/pages/city.css';

export default function CityPage() {
  useEffect(() => {
    document.title = 'Three.js city study | Bluebook';
  }, []);

  return <LittlestTokyo />;
}
