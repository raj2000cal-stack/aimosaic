import PolicyPage from "@/components/PolicyPage";

export const metadata = { title: "Terms of service | AIMosaic" };

export default function Terms() {
  return (
    <PolicyPage title="Terms of service">
      <p>These terms govern your use of AIMosaic. By creating an account you agree to them.</p>
      <h2>The service</h2>
      <p>
        AIMosaic gives you access to third-party AI models through one workspace. We are independent of the
        companies that make those models, and model availability can change without notice.
      </p>
      <h2>Your account</h2>
      <ul>
        <li>You must be at least 18 years old.</li>
        <li>Keep your password private. You are responsible for activity on your account.</li>
        <li>One account per person. Accounts may not be shared or resold.</li>
      </ul>
      <h2>Acceptable use</h2>
      <p>You may not use AIMosaic to:</p>
      <ul>
        <li>break the law or help others to do so;</li>
        <li>create content that exploits or harms children, or that harasses or threatens people;</li>
        <li>generate malware, or attempt to breach or overload this or any other service;</li>
        <li>get around token limits, rate limits or model safeguards;</li>
        <li>violate the usage policies of the model providers.</li>
      </ul>
      <p>We may suspend accounts that break these rules.</p>
      <h2>AI output</h2>
      <p>
        AI models make mistakes and can state false things confidently. Check important information before
        relying on it. Output is not professional advice of any kind.
      </p>
      <h2>Tokens and plans</h2>
      <p>
        Usage is metered as described in the Token policy, which forms part of these terms. Token allowances
        have no cash value.
      </p>
      <h2>Beta</h2>
      <p>
        AIMosaic is in beta. Features may change or be withdrawn, and the service is provided as it is,
        without guarantees of availability.
      </p>
      <h2>Liability, governing law and disputes</h2>
      <p>[To be drafted by counsel for the operating entity&apos;s jurisdiction.]</p>
    </PolicyPage>
  );
}
