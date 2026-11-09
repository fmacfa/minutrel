// SPDX-License-Identifier: AGPL-3.0-or-later
import type { MonthlyReport } from '@minutrel/contracts';
const words: Record<string, [string, string]> = {
  Mois: ['Month', 'Monat'],
  Fuseau: ['Time zone', 'Zeitzone'],
  Salarié: ['Employee', 'Mitarbeiter'],
  Adresse: ['Email', 'E-Mail'],
  Projet: ['Project', 'Projekt'],
  'Sous-catégorie': ['Subcategory', 'Unterkategorie'],
  'Date ou début': ['Date or start', 'Datum oder Beginn'],
  Description: ['Description', 'Beschreibung'],
  Secondes: ['Seconds', 'Sekunden'],
  Durée: ['Duration', 'Dauer'],
  Version: ['Version', 'Version'],
  'Compte rendu validé': ['Approved summary', 'Freigegebener Arbeitsbericht'],
  'Notes partagées': ['Shared notes', 'Geteilte Notizen'],
  'Rapport mensuel': ['Monthly report', 'Monatsbericht'],
  'Temps finalisé': ['Completed time', 'Abgeschlossene Zeit'],
  secondes: ['seconds', 'Sekunden'],
  Instantané: ['Snapshot', 'Momentaufnahme'],
  'Par membre': ['By member', 'Nach Mitglied'],
  'Par projet': ['By project', 'Nach Projekt'],
  'Aucun temps finalisé pour cette période.': [
    'No completed time for this period.',
    'Keine abgeschlossenen Zeiten für diesen Zeitraum.',
  ],
  'Détail des temps': ['Time details', 'Zeitdetails'],
  'Sans description': ['No description', 'Ohne Beschreibung'],
  'Comptes rendus validés': ['Approved summaries', 'Freigegebene Arbeitsberichte'],
  'Aucun compte rendu validé pour ce mois.': [
    'No approved summary for this month.',
    'Kein freigegebener Arbeitsbericht für diesen Monat.',
  ],
  Membre: ['Member', 'Mitglied'],
  'Brouillon IA relu et validé': [
    'AI draft reviewed and approved',
    'KI-Entwurf geprüft und freigegeben',
  ],
  'Rédaction manuelle validée': [
    'Approved manual summary',
    'Freigegebener manueller Arbeitsbericht',
  ],
  'Aucune note partagée pour ce mois.': [
    'No shared notes for this month.',
    'Keine geteilten Notizen für diesen Monat.',
  ],
  'Les durées sont limitées au mois affiché. Pauses et chronomètres en cours exclus.': [
    'Durations are limited to the displayed month. Breaks and active timers are excluded.',
    'Die Zeiten sind auf den angezeigten Monat begrenzt. Pausen und laufende Zeitmessungen sind ausgeschlossen.',
  ],
  'chronomètre(s) actif(s) au moment de l’export.': [
    'active timer(s) at export time.',
    'aktive Zeitmessung(en) beim Export.',
  ],
  'Données déclarées. Les durées sont calculées par le serveur, indépendamment des textes des comptes rendus.':
    [
      'Declared data. Durations are calculated by the server, independently of the summary text.',
      'Erfasste Angaben. Zeiten werden vom Server unabhängig von den Texten der Arbeitsberichte berechnet.',
    ],
};
export function reportText(report: MonthlyReport, key: string) {
  return report.language === 'en'
    ? (words[key]?.[0] ?? key)
    : report.language === 'de'
      ? (words[key]?.[1] ?? key)
      : key;
}
