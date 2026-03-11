// Validation locale des clés pour éviter les erreurs de stockage.
// IMPORTANT: La sécurité doit être assurée par les règles Firestore côté serveur.
const ALLOWED_KEY_PATTERNS: RegExp[] = [
  /^adv_orders$/,
  /^stock_(items|units|movements|sellers)$/,
  /^users$/,
  /^b2b_(prospects|opportunities)$/,
  /^field_(sessions|zones|controls|client_verifications)$/,
  /^kpi_(teams_config|objectives_detail|daily_forecasts)$/,
  /^hr_(settings|raw_records|absences|analysis_index|analysis_results)$/,
  /^hr_analysis_[0-9]{4}-[0-9]{2}$/,
  /^commissions_[0-9]{4}-[0-9]{2}_.+$/,
  /^fleet_(vehicles|drivers|fuel|accidents)$/,
  /^public_/
];

export const isKeyAllowed = (key: string) => ALLOWED_KEY_PATTERNS.some((r) => r.test(key));
