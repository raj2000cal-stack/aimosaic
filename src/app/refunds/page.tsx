import PolicyPage from "@/components/PolicyPage";

export const metadata = { title: "Refund policy | AIMosaic" };

export default function Refunds() {
  return (
    <PolicyPage title="Refund policy">
      <p>
        Paid plans are not on sale yet. This is the policy we intend to apply when they are.
      </p>
      <h2>Seven-day refund</h2>
      <p>
        You can ask for a full refund within 7 days of your first payment for a plan, provided you have used
        less than 10% of that period&apos;s token allowance.
      </p>
      <h2>Renewals and cancellation</h2>
      <ul>
        <li>You can cancel at any time. Your plan stays active until the end of the period you paid for.</li>
        <li>Renewal payments are not refunded once the new period has started, except where the law requires it.</li>
      </ul>
      <h2>Top-up packs</h2>
      <p>Unused top-up packs can be refunded within 7 days of purchase. Partly used packs are not refundable.</p>
      <h2>How to ask</h2>
      <p>[Contact email and expected response time to be added.]</p>
    </PolicyPage>
  );
}
