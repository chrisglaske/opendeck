/** The template cards on the landing page: a built-in template, the theme it's shown in, and a caption. */
export const GALLERY: readonly { templateId: string; themeId: string; name: string; use: string }[] = [
  { templateId: 'title', themeId: 'midnight', name: 'Title', use: 'Pitch' },
  { templateId: 'stats', themeId: 'opendeck', name: 'Big numbers', use: 'Review' },
  { templateId: 'agenda', themeId: 'editorial', name: 'Agenda', use: 'Any deck' },
  { templateId: 'quote', themeId: 'sage', name: 'Quote', use: 'Pitch' },
  { templateId: 'team', themeId: 'boardroom', name: 'Team', use: 'Business' },
  { templateId: 'code', themeId: 'swiss', name: 'Code', use: 'Tech talk' },
]
