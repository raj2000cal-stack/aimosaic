import { Suspense } from "react";
import BillingPage from "@/components/BillingPage";
import { PLANS } from "@/lib/catalog";

export const metadata = { title: "Billing | AIMosaic" };

export default function Billing() {
  // Suspense: the page reads ?status= from the address, which is only known per request.
  return (
    <Suspense fallback={null}>
      <BillingPage plans={PLANS} />
    </Suspense>
  );
}
