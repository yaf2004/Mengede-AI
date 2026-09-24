export const FEED = [
  { type: 'stat', icon: 'bar-chart', color: 'blue', title: 'Software & IT roles are up 18% in Addis Ababa this year',
    body: 'Based on your interest in AI and robotics, demand for junior software and data roles has grown fastest among tech fields tracked this year.' },
  { type: 'university', icon: 'graduation-cap', color: 'emerald', title: 'Addis Ababa Science & Technology University — Robotics & Mechatronics',
    body: 'A strong technical fit for your interests, with active robotics clubs and industry partnerships. Public university, Addis Ababa.' },
  { type: 'opportunity', icon: 'briefcase', color: 'amber', title: 'Entry paths into entrepreneurship without a business degree',
    body: 'Several accelerator and incubator programs in Ethiopia accept technical founders directly — no business background required.' },
  { type: 'resource', icon: 'book-open', color: 'teal', title: 'Free intro robotics & AI courses worth starting with',
    body: 'A curated shortlist of beginner-friendly, no-cost courses that match your stated interests and current skill level.' },
  { type: 'scholarship', icon: 'award', color: 'rose', title: 'Scholarships open to technical & entrepreneurial students',
    body: 'A few active scholarship programs currently accepting applications from students with your profile.' },
];

export const FEED_COLORS = {
  blue: 'bg-blue-50 text-blue-600', emerald: 'bg-emerald-50 text-emerald-600',
  amber: 'bg-amber-50 text-amber-600', teal: 'bg-teal-50 text-teal-600',
  rose: 'bg-rose-50 text-rose-600',
};
export const FEED_LABELS = { stat: 'Local insight', university: 'University match', opportunity: 'Opportunity', resource: 'Resource', scholarship: 'Scholarship' };

export const QUICK_ACTIONS = [
  { icon: 'compass', label: 'Explore my interests', prompt: 'Help me explore my interests and work out what might suit me.' },
  { icon: 'bar-chart', label: 'Show me local stats', prompt: 'What do you know about study and job opportunities in Ethiopia that fit me?' },
  { icon: 'graduation-cap', label: 'Compare pathways', prompt: 'Compare the realistic pathways open to me after school.' },
  { icon: 'briefcase', label: 'Find opportunities', prompt: 'Find opportunities like scholarships, courses or jobs that suit me.' },
  { icon: 'lightbulb', label: 'Build a skill plan', prompt: 'Build me a step-by-step plan to develop the skills I need.' },
  { icon: 'target', label: 'Career guidance', prompt: 'Give me career guidance based on my interests and goals.' },
];

export const COMMUNITY_CATS = ['All', 'General', 'Study Help', 'Career', 'Skills', 'Opportunities'];

export const POSTS = [
  { initial: 'A', color: 'bg-blue-600', title: 'Best way to start learning robotics with no prior background?', author: 'Abebe T.', date: '9/15/2026',
    body: "I'm interested in robotics but have zero engineering background. Where should I actually start?", likes: 45, comments: 23, tag: 'Study Help' },
  { initial: 'M', color: 'bg-rose-500', title: 'Is entrepreneurship realistic without a business degree?', author: 'Meron H.', date: '9/14/2026',
    body: 'Torn between trying to start something now vs. waiting until I have more formal training. What worked for others?', likes: 67, comments: 34, tag: 'Career' },
  { initial: 'D', color: 'bg-emerald-600', title: 'Anyone tried the free AI courses linked in the assistant?', author: 'Dawit M.', date: '9/12/2026',
    body: 'Curious which of the suggested free courses were actually worth the time.', likes: 29, comments: 11, tag: 'Skills' },
];
