import { legalInfo, noticeSections } from '../../content/legal';
import { LegalScreen } from '@/components/LegalScreen';

export default function LegalNoticeScreen() {
  const info = legalInfo();
  return (
    <LegalScreen
      label="Mentions légales"
      title="Mentions légales."
      sections={noticeSections(info)}
      url={info.noticeUrl}
    />
  );
}
