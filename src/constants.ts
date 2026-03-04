export type ColorPalette = {
  id: string;
  name: string;
  colors: {
    pentateuch: string;
    poetry: string;
    prophets: string;
    gospels: string;
    epistles: string;
  }
};

export const PALETTES: ColorPalette[] = [
  {
    id: 'minimal',
    name: 'Minimalist',
    colors: {
      pentateuch: '#525252', // Neutral Gray
      poetry: '#737373', // Neutral Gray
      prophets: '#A3A3A3', // Neutral Gray
      gospels: '#10B981', // Emerald (Focus)
      epistles: '#D4D4D4', // Light Gray
    }
  },
  {
    id: 'neon',
    name: 'Neon Lights',
    colors: {
      pentateuch: '#10B981', // Mint
      poetry: '#8B5CF6', // Lavender
      prophets: '#F59E0B', // Amber
      gospels: '#3B82F6', // Blue
      epistles: '#EC4899', // Pink
    }
  },
  {
    id: 'sunset',
    name: 'Sunset Glow',
    colors: {
      pentateuch: '#264653',
      poetry: '#2A9D8F',
      prophets: '#E9C46A',
      gospels: '#F4A261',
      epistles: '#E76F51',
    }
  },
  {
    id: 'ocean',
    name: 'Deep Ocean',
    colors: {
      pentateuch: '#03045E',
      poetry: '#0077B6',
      prophets: '#00B4D8',
      gospels: '#90E0EF',
      epistles: '#CAF0F8',
    }
  },
  {
    id: 'jewel',
    name: 'Jewel Tones',
    colors: {
      pentateuch: '#006D77',
      poetry: '#83C5BE',
      prophets: '#EDF6F9',
      gospels: '#FFDDD2',
      epistles: '#E29578',
    }
  },
  {
    id: 'earth',
    name: 'Earthy Tones',
    colors: {
      pentateuch: '#6B705C',
      poetry: '#A5A58D',
      prophets: '#B5838D',
      gospels: '#E5989B',
      epistles: '#FFB4A2',
    }
  }
];
