import { AuthGate } from "@/components/workspace/auth-gate";
import TradesPage from "@/components/trade/trade-workspace";

export default function TradePage() {
  return <AuthGate><TradesPage /></AuthGate>;
}
