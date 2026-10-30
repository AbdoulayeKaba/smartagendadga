/** Résultat d'envoi du mail de bienvenue (API création utilisateur). */
export type WelcomeEmailDelivery =
  | 'sent'
  | 'mock'
  | 'no_smtp'
  | 'simulated'
  | 'failed';

export function welcomeEmailToastDescription(
  delivery: WelcomeEmailDelivery | undefined,
  requested: boolean
): string | undefined {
  if (!requested) return undefined;
  switch (delivery) {
    case 'sent':
      return 'Un email de bienvenue a été envoyé à l’adresse indiquée.';
    case 'mock':
      return (
        'Mode démo (USE_MOCK_DATA) : email simulé uniquement, aucun message réel. ' +
        'Pour un envoi réel : USE_MOCK_DATA=false, NEXT_PUBLIC_USE_MOCK_DATA=false, redémarrez l’application, ' +
        'puis configurez le SMTP dans Administration → Paramètres.'
      );
    case 'no_smtp':
      return (
        'Compte créé. Renseignez le SMTP (hôte et expéditeur) dans Administration → Paramètres. ' +
        'Si USE_MOCK_DATA est actif, passez-le à false et redémarrez pour activer l’envoi réel.'
      );
    case 'simulated':
      return (
        'Email simulé (développement, SMTP non configuré). Aucun message réel n’a été envoyé.'
      );
    case 'failed':
      return (
        'Compte créé, mais l’envoi SMTP a échoué. Vérifiez hôte, port, identifiants et expéditeur dans Paramètres.'
      );
    default:
      return undefined;
  }
}
