import { AuctionDraftService } from '@/services/auctionDraftService';
import { BloombergDraftInterface } from '@/components/BloombergDraftInterface';
import '@/styles/bloomberg-terminal.css';

// Initialize draft service
const draftService = new AuctionDraftService();

const Index = () => {
  return <BloombergDraftInterface draftService={draftService} />;
};

export default Index;
