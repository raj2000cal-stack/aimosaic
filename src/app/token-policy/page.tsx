import PolicyPage from "@/components/PolicyPage";
import { MODELS, PLANS } from "@/lib/catalog";

export const metadata = { title: "Token policy | AIMosaic" };

export default function TokenPolicy() {
  return (
    <PolicyPage title="Token policy">
      <p>
        AIMosaic is metered. Every plan has a monthly token allowance, and nothing is described as unlimited.
        This page explains exactly how tokens are counted.
      </p>
      <h2>What a token is</h2>
      <p>
        A token is a small piece of text, roughly three quarters of an English word. Both what you send
        (including earlier messages in the same chat and attached text) and what the model writes back count.
      </p>
      <h2>Model rates</h2>
      <p>
        Standard models use your wallet at <strong>1x</strong>. Premium models cost us more to run and use it
        at <strong>4x</strong>: a reply of 500 tokens from a premium model takes 2,000 tokens from your wallet.
      </p>
      <table className="w-full text-sm">
        <thead>
          <tr><th>Model</th><th>Tier</th><th>Rate</th></tr>
        </thead>
        <tbody>
          {MODELS.map((m) => (
            <tr key={m.id}><td>{m.displayName}</td><td className="capitalize">{m.tier}</td><td>{m.multiplier}x</td></tr>
          ))}
        </tbody>
      </table>
      <h2>Monthly allowances</h2>
      <table className="w-full text-sm">
        <thead>
          <tr><th>Plan</th><th>Tokens each month</th><th>Premium models</th></tr>
        </thead>
        <tbody>
          {PLANS.map((p) => (
            <tr key={p.id}><td>{p.name}</td><td>{p.monthlyTokens.toLocaleString("en-US")}</td><td>{p.premiumModels ? "Included" : "Not included"}</td></tr>
          ))}
        </tbody>
      </table>
      <h2>How a message is charged</h2>
      <ul>
        <li>Before sending, the app shows the most a message could cost. That amount is held from your wallet.</li>
        <li>When the reply finishes, you are charged only for the tokens actually used and the rest is released.</li>
        <li>If a model fails before writing anything, you are not charged.</li>
        <li>In Compare Mode each selected model is a separate request and is charged separately.</li>
      </ul>
      <h2>Worked example</h2>
      <p>
        You ask a 30-token question and compare one standard and one premium model. Each replies with 200
        tokens. The standard model costs 230 tokens. The premium model costs 230 x 4 = 920 tokens. Total: 1,150 tokens.
      </p>
      <h2>Running out</h2>
      <p>
        When your wallet cannot cover a message, the message is not sent. You can switch to a 1x model or wait
        for your next monthly allowance. Top-up packs and rollover of unused tokens are planned and will be
        described here when available.
      </p>
    </PolicyPage>
  );
}
