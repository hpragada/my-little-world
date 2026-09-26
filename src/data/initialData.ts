import {
  MoodOption,
  Task,
  JournalEntry,
  Memory,
  CalendarEvent,
  Dream,
  UserProfile,
  FutureLetter,
} from '../types';

import imgDeskJournal from '../assets/images/aesthetic_desk_journal_1790344269761.jpg';
import imgMorningWindow from '../assets/images/serene_morning_window_1790344288710.jpg';
import imgStarlitNight from '../assets/images/starlit_night_sanctuary_1790344300613.jpg';
import imgLavenderDusk from '../assets/images/lavender_field_dusk_1790344317059.jpg';

export const MOOD_OPTIONS: MoodOption[] = [
  { id: 'serene', label: 'Serene', symbol: '✦', description: 'At peace, still, and centered' },
  { id: 'grateful', label: 'Grateful', symbol: '✧', description: 'Holding appreciation in the heart' },
  { id: 'calm', label: 'Calm', symbol: '〰', description: 'Steady, unhurried, breathing easy' },
  { id: 'reflective', label: 'Reflective', symbol: '☽', description: 'Lost in thoughtful wonder' },
  { id: 'soft', label: 'Soft', symbol: '❀', description: 'Gentle with myself and the world' },
  { id: 'tired', label: 'Tired', symbol: '☁', description: 'Low energy, needing gentle rest' },
  { id: 'hopeful', label: 'Hopeful', symbol: '☼', description: 'Looking forward with gentle optimism' },
];

export const INITIAL_USER: UserProfile = {
  name: 'Eleanor',
  subtitle: 'Welcome to your little world.',
  lowEnergyMode: false,
  currentMood: 'serene',
  avatarSeed: 'sanctuary',
};

export const INITIAL_TASKS: Task[] = [
  {
    id: 't-1',
    title: 'Morning lavender tea & 10 slow breaths',
    category: 'ritual',
    completed: true,
    isLowEnergyTask: true,
    createdAt: '2026-09-25T07:30:00Z',
  },
  {
    id: 't-2',
    title: 'Write three gentle sentences in the journal',
    category: 'gentle',
    completed: true,
    isLowEnergyTask: true,
    createdAt: '2026-09-25T08:00:00Z',
  },
  {
    id: 't-3',
    title: 'Review quiet design ideas for portfolio update',
    category: 'focus',
    completed: false,
    isLowEnergyTask: false,
    createdAt: '2026-09-25T09:15:00Z',
  },
  {
    id: 't-4',
    title: 'Afternoon walk beneath the autumn trees',
    category: 'ritual',
    completed: false,
    isLowEnergyTask: true,
    createdAt: '2026-09-25T11:00:00Z',
  },
  {
    id: 't-5',
    title: 'Tidy bedside corner & light jasmine candle',
    category: 'rest',
    completed: false,
    isLowEnergyTask: false,
    createdAt: '2026-09-25T14:30:00Z',
  },
];

export const LOW_ENERGY_TASKS: Task[] = [
  {
    id: 'le-1',
    title: 'Sip a glass of warm water or herbal tea',
    category: 'gentle',
    completed: true,
    isLowEnergyTask: true,
    createdAt: '2026-09-25T07:00:00Z',
  },
  {
    id: 'le-2',
    title: 'Step near an open window and feel the quiet breeze',
    category: 'gentle',
    completed: false,
    isLowEnergyTask: true,
    createdAt: '2026-09-25T07:05:00Z',
  },
  {
    id: 'le-3',
    title: 'Rest without guilt: no expectations right now',
    category: 'rest',
    completed: false,
    isLowEnergyTask: true,
    createdAt: '2026-09-25T07:10:00Z',
  },
];

export const INITIAL_JOURNAL_ENTRIES: JournalEntry[] = [
  {
    id: 'j-1',
    title: 'The quiet beauty of an unhurried morning',
    content:
      'The morning began in soft charcoal light. Rain was tapping so softly against the glass that it sounded like a whisper. I sat with warm ceramic in both hands and allowed the thoughts to settle like dust after a storm. I don’t need to conquer anything today. It is enough simply to exist, to observe, and to be gentle with my hours.',
    date: 'September 24, 2026',
    mood: 'serene',
    tags: ['Quiet Thoughts', 'Morning', 'Peace'],
    readTimeMinutes: 2,
  },
  {
    id: 'j-2',
    title: 'Small things that anchored me today',
    content:
      'Sometimes the sweetest days are woven from tiny fragments: fresh linen sheets dried by the autumn breeze, the scent of lavender oil on my wrists, hearing someone laugh softly down the street, and giving myself permission to close my laptop at five o’clock sharp.',
    date: 'September 22, 2026',
    mood: 'grateful',
    tags: ['Gratitude', 'Rituals'],
    readTimeMinutes: 2,
  },
  {
    id: 'j-3',
    title: 'Notes on building a quieter life',
    content:
      'I am realizing that ambition does not have to be loud. One can build meaningful work, cultivate deep friendships, and pursue dreams without frantic hustle. Grace, patience, and deliberate focus are far more enduring than urgency.',
    date: 'September 18, 2026',
    mood: 'reflective',
    tags: ['Growth', 'Philosophy', 'Career'],
    readTimeMinutes: 3,
  },
];

export const INITIAL_MEMORIES: Memory[] = [
  {
    id: 'm-1',
    title: 'Desk in the soft glow of dusk',
    caption: 'My favorite corner. Where words find their resting place and tea never goes cold too quickly.',
    date: 'September 2026',
    location: 'Home Sanctuary',
    imageSrc: imgDeskJournal,
    category: 'Home & Rituals',
    aspect: 'landscape',
  },
  {
    id: 'm-2',
    title: 'First light through linen curtains',
    caption: 'The quietest 20 minutes of the day before the city awakens. Pure stillness.',
    date: 'September 2026',
    location: 'Bedroom Window',
    imageSrc: imgMorningWindow,
    category: 'Mornings',
    aspect: 'landscape',
  },
  {
    id: 'm-3',
    title: 'Midnight balcony thoughts',
    caption: 'Looking up into the indigo expanse. The stars remind me how vast time is, and how sweet this moment is.',
    date: 'August 2026',
    location: 'Balcony',
    imageSrc: imgStarlitNight,
    category: 'Nights',
    aspect: 'landscape',
  },
  {
    id: 'm-4',
    title: 'Dried lavender from the countryside',
    caption: 'A gentle reminder that nature does not hurry, yet everything is accomplished.',
    date: 'August 2026',
    location: 'Botanical Garden',
    imageSrc: imgLavenderDusk,
    category: 'Nature',
    aspect: 'landscape',
  },
];

export const INITIAL_DREAMS: Dream[] = [
  {
    id: 'd-1',
    title: 'A cottage library with floor-to-ceiling bookshelves',
    category: 'peace',
    description: 'A dedicated reading haven with a velvet armchair, bay window, and fragrant cedar shelves.',
    progressPercent: 65,
    timeframe: 'Next 2 Years',
    pinnedToHome: true,
  },
  {
    id: 'd-2',
    title: 'Autumn residency in Kyoto or Provence',
    category: 'travel',
    description: 'Spending three quiet weeks writing, sketching ceramics, and listening to rain in ancient gardens.',
    progressPercent: 40,
    timeframe: 'Autumn 2027',
    pinnedToHome: true,
  },
  {
    id: 'd-3',
    title: 'Publish a small book of prose & quiet photography',
    category: 'creative',
    description: 'Collecting reflections on slowness, aesthetics, and self-compassion into a clothbound volume.',
    progressPercent: 55,
    timeframe: 'In Progress',
    pinnedToHome: true,
  },
  {
    id: 'd-4',
    title: 'Master botanical watercolor painting',
    category: 'creative',
    description: 'Weekly weekend practice painting pressed ferns, lavender, and autumn leaves.',
    progressPercent: 25,
    timeframe: 'Lifelong',
    pinnedToHome: false,
  },
];

export const INITIAL_EVENTS: CalendarEvent[] = [
  {
    id: 'e-1',
    title: 'Morning stillness & Japanese green tea',
    time: '08:00 AM',
    date: '2026-09-25',
    type: 'ritual',
    description: 'Screen-free morning ritual to center the mind.',
  },
  {
    id: 'e-2',
    title: 'Weekly project review & creative sketching',
    time: '11:00 AM',
    date: '2026-09-25',
    type: 'career',
    description: 'Quiet review of milestones without pressure.',
  },
  {
    id: 'e-3',
    title: 'Stroll through the botanical conservatory',
    time: '04:30 PM',
    date: '2026-09-26',
    type: 'personal',
    description: 'Gentle walking meditation with sketchbook.',
  },
  {
    id: 'e-4',
    title: 'Evening candlelit bath & lavender mist',
    time: '08:30 PM',
    date: '2026-09-26',
    type: 'rest',
    description: 'Unwind and leave digital devices in the outer room.',
  },
  {
    id: 'e-5',
    title: 'Call Aunt Clara for tea chat',
    time: '02:00 PM',
    date: '2026-09-28',
    type: 'personal',
    description: 'Sharing memories and seasonal recipes.',
  },
];

export const INITIAL_FUTURE_LETTERS: FutureLetter[] = [
  {
    id: 'fl-1',
    title: 'A gentle note to the one who persevered',
    content:
      'Dear future self,\n\nIf you are reading this, time has quietly moved forward. Remember the autumn days when you felt unsure of the path? You were planting seeds that you could not yet see. I hope you still pause for evening tea, I hope you still look up at the night sky with soft wonder, and above all, I hope you are proud of how gently and steadily you kept going.\n\nWith love,\nYour past self',
    createdAt: '2026-09-01T10:00:00.000Z',
    openDate: '2026-09-20',
    mood: 'serene',
    isSealed: false,
  },
  {
    id: 'fl-2',
    title: 'On dreams, patience, and next year’s horizon',
    content:
      'To myself in the coming year,\n\nDid the cottage library begin to take shape? Have you taken that quiet walk in ancient gardens? Whatever happened, remember that life is not a race. You never needed to rush the things you wanted to last forever. Drink your water, breathe deeply, and be kind to yourself.',
    createdAt: '2026-09-25T07:00:00.000Z',
    openDate: '2027-01-01',
    mood: 'hopeful',
    isSealed: true,
  },
];
