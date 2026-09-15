import { GuardianPlayerDetailPage } from '@/components/guardian/pages/GuardianPlayerDetailPage';
export default async function Page({ params }: { params: Promise<{ playerId: string }> }) {
  const { playerId } = await params;
  return <GuardianPlayerDetailPage playerId={playerId} />;
}
