export const parseBibleReference = (query: string, books: {name: string}[]) => {
  if (!query) return null;

  // Normalize query
  let normalized = query.toLowerCase()
    .replace(/á/g, 'a')
    .replace(/é/g, 'e')
    .replace(/í/g, 'i')
    .replace(/ó/g, 'o')
    .replace(/ú/g, 'u')
    .replace(/capitulo/g, ' ')
    .replace(/versiculo/g, ' ')
    .replace(/capítulo/g, ' ')
    .replace(/versículo/g, ' ')
    .replace(/cap/g, ' ')
    .replace(/ver/g, ' ')
    .replace(/v\./g, ' ')
    .replace(/c\./g, ' ')
    .replace(/,/g, ' ')
    .replace(/:/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Map Spanish number words to digits (basic)
  const numberWords: Record<string, string> = {
    'uno': '1', 'dos': '2', 'tres': '3', 'cuatro': '4', 'cinco': '5',
    'seis': '6', 'siete': '7', 'ocho': '8', 'nueve': '9', 'diez': '10',
    'once': '11', 'doce': '12', 'trece': '13', 'catorce': '14', 'quince': '15',
    'dieciseis': '16', 'diecisiete': '17', 'dieciocho': '18', 'diecinueve': '19', 'veinte': '20',
    'veintiuno': '21', 'veintidos': '22', 'veintitres': '23', 'veinticuatro': '24', 'veinticinco': '25'
  };

  for (const [word, digit] of Object.entries(numberWords)) {
    const regex = new RegExp(`\\b${word}\\b`, 'g');
    normalized = normalized.replace(regex, digit);
  }

  // Map Spanish book names to English (simplified)
  const bookMap: Record<string, string> = {
    'genesis': 'Genesis', 'exodo': 'Exodus', 'levitico': 'Leviticus', 'numeros': 'Numbers', 'deuteronomio': 'Deuteronomy',
    'josue': 'Joshua', 'jueces': 'Judges', 'rut': 'Ruth', '1 samuel': '1 Samuel', '2 samuel': '2 Samuel',
    '1 reyes': '1 Kings', '2 reyes': '2 Kings', '1 cronicas': '1 Chronicles', '2 cronicas': '2 Chronicles',
    'esdras': 'Ezra', 'nehemias': 'Nehemiah', 'ester': 'Esther', 'job': 'Job', 'salmos': 'Psalms', 'salmo': 'Psalms',
    'proverbios': 'Proverbs', 'eclesiastes': 'Ecclesiastes', 'cantares': 'Song of Solomon', 'isaias': 'Isaiah',
    'jeremias': 'Jeremiah', 'lamentaciones': 'Lamentations', 'ezequiel': 'Ezekiel', 'daniel': 'Daniel',
    'oseas': 'Hosea', 'joel': 'Joel', 'amos': 'Amos', 'abdias': 'Obadiah', 'jonas': 'Jonah',
    'miqueas': 'Micah', 'nahum': 'Nahum', 'habacuc': 'Habakkuk', 'sofonias': 'Zephaniah', 'hageo': 'Haggai',
    'zacarias': 'Zechariah', 'malaquias': 'Malachi', 'mateo': 'Matthew', 'marcos': 'Mark', 'lucas': 'Luke',
    'juan': 'John', 'hechos': 'Acts', 'romanos': 'Romans', '1 corintios': '1 Corinthians', '2 corintios': '2 Corinthians',
    'galatas': 'Galatians', 'efesios': 'Ephesians', 'filipenses': 'Philippians', 'colosenses': 'Colossians',
    '1 tesalonicenses': '1 Thessalonians', '2 tesalonicenses': '2 Thessalonians', '1 timoteo': '1 Timothy',
    '2 timoteo': '2 Timothy', 'tito': 'Titus', 'filemon': 'Philemon', 'hebreos': 'Hebrews',
    'santiago': 'James', '1 pedro': '1 Peter', '2 pedro': '2 Peter', '1 juan': '1 John',
    '2 juan': '2 John', '3 juan': '3 John', 'judas': 'Jude', 'apocalipsis': 'Revelation'
  };

  let matchedBook = '';
  let remaining = normalized;

  // Try to find a matching book
  // First check Spanish names
  for (const [es, en] of Object.entries(bookMap)) {
    if (normalized.startsWith(es)) {
      matchedBook = en;
      remaining = normalized.substring(es.length).trim();
      break;
    }
  }

  // Then check English names
  if (!matchedBook) {
    for (const book of books) {
      const enLower = book.name.toLowerCase();
      if (normalized.startsWith(enLower)) {
        matchedBook = book.name;
        remaining = normalized.substring(enLower.length).trim();
        break;
      }
    }
  }

  if (!matchedBook) return null;

  // Now parse chapter and verse from remaining
  const numbers = remaining.split(/\s+/).filter(n => /^\d+$/.test(n)).map(Number);
  
  return {
    book: matchedBook,
    chapter: numbers[0] || null,
    verse: numbers[1] || null
  };
};
