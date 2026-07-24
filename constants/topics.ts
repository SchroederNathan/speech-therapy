/** Freestyle (impromptu) speaking topics. */

export type FreestyleTopic = {
  id: string;
  title: string;
  /** The prompt shown before/while speaking. */
  prompt: string;
};

export const TOPICS: FreestyleTopic[] = [
  {
    id: 'introduce-yourself',
    title: 'Introduce yourself',
    prompt: 'Introduce yourself to someone you just met: who you are, what you do, and one thing you care about.',
  },
  {
    id: 'perfect-day',
    title: 'Your perfect day',
    prompt: 'Walk through your perfect day from morning to night. Where are you, and what makes it perfect?',
  },
  {
    id: 'teach-something',
    title: 'Teach something',
    prompt: 'Explain something you know well to a complete beginner in under two minutes.',
  },
  {
    id: 'favorite-place',
    title: 'A favorite place',
    prompt: 'Describe a place you love so vividly that a listener could picture standing there.',
  },
  {
    id: 'changed-mind',
    title: 'Changed your mind',
    prompt: 'Talk about something you once believed and no longer do. What changed it?',
  },
  {
    id: 'pitch-an-idea',
    title: 'Pitch an idea',
    prompt: 'You have ninety seconds with someone who can make your idea real. Pitch it.',
  },
  {
    id: 'movie-retell',
    title: 'Retell a story',
    prompt: 'Retell the plot of a movie, book, or show you enjoyed, from beginning to end.',
  },
  {
    id: 'advice-younger',
    title: 'Advice to younger you',
    prompt: 'What would you tell yourself five years ago? Explain why it matters.',
  },
  {
    id: 'dream-project',
    title: 'Dream project',
    prompt: 'Money and time are no object. What do you build, make, or do, and why that?',
  },
  {
    id: 'small-joy',
    title: 'A small joy',
    prompt: 'Talk about a small, ordinary thing that reliably makes your day better.',
  },
  {
    id: 'hard-decision',
    title: 'A hard decision',
    prompt: 'Describe a difficult decision you made, the options you weighed, and how you chose.',
  },
  {
    id: 'defend-opinion',
    title: 'Defend an opinion',
    prompt: 'Pick a mild, harmless opinion you hold strongly and make the best case for it.',
  },
  {
    id: 'how-it-works',
    title: 'How it works',
    prompt: 'Pick an everyday thing like bridges, coffee, or Wi-Fi and explain how it actually works.',
  },
  {
    id: 'memorable-meal',
    title: 'A memorable meal',
    prompt: 'Describe the most memorable meal of your life: the food, the place, the company.',
  },
  {
    id: 'time-capsule',
    title: 'Time capsule',
    prompt: 'You can put three objects in a time capsule for people fifty years from now. What and why?',
  },
  {
    id: 'unexpected-lesson',
    title: 'An unexpected lesson',
    prompt: 'Talk about a time something went wrong and taught you more than success would have.',
  },
  {
    id: 'tour-guide',
    title: 'Be a tour guide',
    prompt: 'Give a walking tour of your neighborhood or hometown, hitting the spots only locals know.',
  },
  {
    id: 'future-tech',
    title: 'Future technology',
    prompt: 'Pick a technology you think will change daily life in ten years. Paint the picture.',
  },
  {
    id: 'weekend-plan',
    title: 'Sell a weekend plan',
    prompt: 'Convince a reluctant friend to join your ideal weekend plan. Handle their objections.',
  },
  {
    id: 'origin-story',
    title: 'Origin story',
    prompt: 'How did you get into the work or hobby you spend the most time on? Tell that story.',
  },
];

export function getTopic(id: string | undefined): FreestyleTopic | undefined {
  return TOPICS.find((t) => t.id === id);
}

export function randomTopic(excludeId?: string): FreestyleTopic {
  const pool = TOPICS.filter((t) => t.id !== excludeId);
  return pool[Math.floor(Math.random() * pool.length)];
}
