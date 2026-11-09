import { legalInfo, privacySections } from '../../content/legal';
import { LegalScreen } from '@/components/LegalScreen';

export default function PrivacyScreen() {
  const info = legalInfo();
  return (
    <LegalScreen
      label="Confidentialité"
      title="Politique de confidentialité."
      sections={privacySections(info)}
      url={info.privacyUrl}
    />
  );
}
