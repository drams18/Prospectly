export type ScriptType = 'call' | 'sms' | 'email'

export interface ProspectionScript {
  type: ScriptType
  category: string
  label: string | null
  subject: string | null
  content: string
}

export const SCRIPTS: ProspectionScript[] = [
  // Appel — accroches
  { type: 'call', category: 'accroche', label: null, subject: null, content: "Bonjour, je vous appelle pas pour vous vendre quoi que ce soit, j'ai juste une question rapide, vous avez trente secondes ?" },
  { type: 'call', category: 'accroche', label: null, subject: null, content: "Salut, désolé de vous déranger en plein service, je fais vite : est-ce que les gens vous trouvent facilement sur Google ?" },
  { type: 'call', category: 'accroche', label: null, subject: null, content: "Bonjour, je passe un coup de fil éclair — c'est vous qui vous occupez de la partie communication ou site internet ici ?" },
  { type: 'call', category: 'accroche', label: null, subject: null, content: "Bonjour, je suis tombé sur votre établissement en cherchant sur Google et je me suis dit que je pouvais vous faire gagner du temps sur un truc, vous avez deux minutes ?" },

  // Appel — corps du message
  { type: 'call', category: 'corps', label: null, subject: null, content: "En fait j'aide les commerces du coin à avoir plus de clients grâce à internet : un site simple, être mieux visible sur Google, et pouvoir prendre des rendez-vous tout seul sans passer son temps au téléphone. Je regarde en ce moment ce qui pourrait être amélioré, rien d'obligatoire, juste pour voir si ça peut vous servir." },

  // Appel — questions ouvertes
  { type: 'call', category: 'question', label: null, subject: null, content: "Est-ce que c'est un sujet qui vous parle en ce moment ?" },
  { type: 'call', category: 'question', label: null, subject: null, content: "Vous diriez que c'est plutôt le site, la visibilité sur Google, ou les rendez-vous qui vous embête le plus ?" },
  { type: 'call', category: 'question', label: null, subject: null, content: "Ça vous dérange si je vous montre rapidement ce que ça donnerait chez vous ?" },

  // Appel — objections
  { type: 'call', category: 'objection', label: 'Je suis occupé.', subject: null, content: "Pas de souci, je vous laisse tranquille. Je vous envoie un message et vous regardez quand vous avez cinq minutes ?" },
  { type: 'call', category: 'objection', label: 'On a déjà un site.', subject: null, content: "Ah nickel. Il vous ramène des clients ou il sert plutôt de carte de visite ? La plupart des sites que je croise sont juste là pour faire joli, sans vraiment convertir." },
  { type: 'call', category: 'objection', label: 'Ça ne nous intéresse pas.', subject: null, content: "Pas de souci du tout. Juste par curiosité, c'est parce que quelqu'un s'en occupe déjà, ou c'est pas une priorité en ce moment ?" },
  { type: 'call', category: 'objection', label: 'Envoyez-moi un mail.', subject: null, content: "Avec plaisir, c'est à quelle adresse ? ... Parfait, je vous envoie ça dans la journée." },

  // SMS — variantes
  { type: 'sms', category: 'variante', label: 'Variante 1', subject: null, content: "Bonjour, je travaille sur la visibilité en ligne des commerces du coin. J'ai regardé rapidement et il y a deux ou trois trucs simples à améliorer. Ça vous dit que je vous montre en 2 minutes ?" },
  { type: 'sms', category: 'variante', label: 'Variante 2', subject: null, content: "Bonjour, petit message rapide : je crois que vous perdez des clients à cause de votre présence sur Google. Rien de grave, ça se corrige vite. Vous voulez que je vous explique comment ?" },
  { type: 'sms', category: 'variante', label: 'Variante 3', subject: null, content: "Bonjour, je passe régulièrement dans le coin et je me demandais pourquoi vous n'apparaissiez pas mieux sur Google. J'ai une idée simple pour ça, dispo pour en discuter deux minutes ?" },
  { type: 'sms', category: 'variante', label: 'Variante 4', subject: null, content: "Bonjour, j'aide des commerces à avoir plus de rendez-vous sans effort supplémentaire, juste en améliorant leur site et leur visibilité. Ça vous parle ou pas du tout en ce moment ?" },
  { type: 'sms', category: 'variante', label: 'Variante 5', subject: null, content: "Bonjour, question rapide : les gens arrivent facilement à vous trouver ou à prendre rendez-vous en ligne ? Si c'est pas le cas j'ai une solution simple à vous montrer, ça vous dit ?" },

  // Email — versions
  { type: 'email', category: 'standard', label: 'Standard', subject: 'Une question rapide sur votre visibilité en ligne', content: "Bonjour,\n\nPetit message direct : je remarque souvent des commerces qui perdent des clients sans le savoir, à cause d'un site vieillissant, d'une mauvaise visibilité sur Google, ou de rendez-vous encore pris à la main.\n\nJe ne sais pas si c'est votre cas, mais je peux regarder ça en deux minutes et vous dire honnêtement si ça vaut le coup d'améliorer quelque chose, ou pas.\n\nÇa vous dit qu'on en parle cette semaine ?" },
  { type: 'email', category: 'professionnelle', label: 'Professionnelle', subject: 'Amélioration de votre visibilité en ligne — 2 minutes', content: "Bonjour,\n\nJe me permets de vous contacter au sujet de votre présence en ligne. Après un rapide coup d'œil, plusieurs points pourraient être optimisés : la visibilité sur Google, la prise de rendez-vous en ligne, et la conversion des visiteurs en clients.\n\nJe ne cherche pas à vous vendre quoi que ce soit dans l'immédiat, simplement à savoir si le sujet vous intéresse, et si oui, à vous montrer concrètement ce qui pourrait être amélioré.\n\nAuriez-vous quelques minutes cette semaine pour en discuter ?" },
  { type: 'email', category: 'decontractee', label: 'Décontractée', subject: 'Petite question sur votre site (ou son absence)', content: "Salut,\n\nJe te contacte vite fait : j'aide des commerces à avoir plus de clients grâce à un site simple, une meilleure visibilité sur Google et des rendez-vous pris automatiquement.\n\nPas de blabla commercial, juste une question : ça t'intéresse d'en parler deux minutes cette semaine ?" },
  { type: 'email', category: 'courte', label: 'Très courte', subject: '2 minutes ?', content: "Bonjour,\n\nJe pense pouvoir vous aider à avoir plus de clients grâce à votre présence en ligne. Ça vous dit qu'on en parle deux minutes cette semaine ?" },
]

export function buildSmsMessage(name: string, category?: string | null): string {
  const type = (category || '').toLowerCase()
  let label = 'établissements'
  if (type.includes('hair') || type.includes('beauty')) label = 'salons'
  else if (type.includes('restaurant') || type.includes('food')) label = 'restaurants'
  else if (type.includes('gym') || type.includes('fitness')) label = 'salles de sport'
  else if (type.includes('car') || type.includes('garage')) label = 'garages'
  else if (type.includes('store') || type.includes('shop')) label = 'commerces'
  return `Bonjour, je vous contacte car j'aide les ${label} comme ${name || 'votre établissement'} à obtenir plus de clients via Google et à automatiser les réservations. Est-ce que vous avez déjà un site ou pas vraiment optimisé aujourd'hui ?`
}

export function buildCallScript(name: string, category?: string | null): string {
  const type = (category || '').toLowerCase()
  let label = 'commerces'
  if (type.includes('hair') || type.includes('beauty')) label = 'salons'
  else if (type.includes('restaurant') || type.includes('food')) label = 'restaurants'
  else if (type.includes('gym') || type.includes('fitness')) label = 'salles de sport'
  else if (type.includes('car') || type.includes('garage')) label = 'garages'
  return `Bonjour, je travaille avec des ${label} comme ${name || 'votre établissement'} pour leur apporter plus de clients via Google et simplifier les réservations. Je voulais savoir si vous avez déjà un site performant aujourd'hui ?`
}
