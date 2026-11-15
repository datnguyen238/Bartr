import { AuthGate } from "@/components/workspace/auth-gate";
import TradesPage from "@/components/trade/live-trades";

export default function TradePage() {
  return <AuthGate><TradesPage /></AuthGate>;
}
