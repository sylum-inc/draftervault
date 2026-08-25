import { AuctionDraftService } from '@/services/auctionDraftService';
import { AuctionDraftInterface } from '@/components/AuctionDraftInterface';

// Initialize draft service
const draftService = new AuctionDraftService();

const Index = () => {
  return <AuctionDraftInterface draftService={draftService} />;
};

export default Index;
