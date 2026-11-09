import { legalInfo, termsSections } from '../../content/legal';
import { LegalScreen } from '@/components/LegalScreen';

export default function TermsScreen() {
  const info = legalInfo();
  return (
    <LegalScreen
      label="CGU"
      title="Conditions générales d’utilisation."
      sections={termsSections(info)}
      url={info.termsUrl}
    />
  );
}
