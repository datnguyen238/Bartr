import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
export default function TradePage() {
  return <section className="trade-screen">
    <div className="screen-heading"><h1 className="screen-title">Good exchanges start here.</h1><p className="screen-description">A little preparation makes room for something useful.</p></div>
    <div className="trade-preparation surface-panel">
      <div className="trade-mark"><Icon name="trade" width="32" height="32" /></div>
      <h2>Trading is coming next</h2>
      <p>Discovery and offers are still being prepared. For now, build your inventory and tell Bartr what you’re looking for.</p>
      <ol className="preparation-steps">
        <li><span aria-hidden="true">1</span><div><strong>Add something you’re ready to pass on</strong><p>Start with a photo or enter the details yourself.</p></div></li>
        <li><span aria-hidden="true">2</span><div><strong>Tell us what would be useful</strong><p>Choose specific items, broader interests and things to avoid.</p></div></li>
        <li><span aria-hidden="true">3</span><div><strong>Review before you agree</strong><p>Future suggestions are optional. Every exchange will need both people’s agreement.</p></div></li>
      </ol>
      <div className="form-actions"><Button asChild><Link href="/profile/inventory">Prepare your inventory <Icon name="arrow" /></Link></Button><Button variant="outline" asChild><Link href="/profile/preferences">Set your interests</Link></Button></div>
    </div>
  </section>;
}
