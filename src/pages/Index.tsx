import { AuctionDraftService } from '@/services/auctionDraftService';
import { DraftRoom } from '@/components/draft-room/DraftRoom';

// Initialize draft service
const draftService = new AuctionDraftService();

const Index = () => {
  return <DraftRoom draftService={draftService} />;
};

export default Index;
